let robot = require('robotjs')
let data = require('./data.js')
let path = []
let fs = require('fs')
let pathModule = require('path')
// Load all the navigation variables for roamer
let navVariables = fs.readFileSync(pathModule.resolve(__dirname, '../../Database/lib/roamerConstants.json'))
navVariables = JSON.parse(navVariables)

DEBUGGING = false
const debug = msg => DEBUGGING && console.log(msg)

// Unstuck constants object
exports.UNSTUCK = navVariables.unstuck
const NEAREST_POINT_THRESHOLD = 0.3
const file_path = '../../Database/lib/PathCoordinates/Paths/'
let ROAMVAR

//zones where the coordinate system is more condensed : The major cities in Kalimdor
let zoneList = ['ORGRIM', 'THUNDE', 'DARNAS', "UN'GOR", 'SILITH', 'LOCH M', 'HILLSB', 'ALTERA', 'WETLAN', 'DUN MO']

let pathx = []
let pathy = []
let direction = []
let zone = []
let previousPath = []

let paused = false
let resetRoamer = false
let navigationActive = false

let can_turn = true

let deathrun = false
let curr_path = ''
let vendor_run = false
let vendor_run_completed = false
let walking_towards_corpse = false

let MIN_TURN_DISTANCE_BEFORE_FULL_STOP = 500

let total_waypoints = 0

// We need to keep track of which point in the array our character is running to next.
// When we use the combat script, we need to stop and record what point we were traveling to next. If we don't store the point we are traveling to next, the script starts going back to the very first point in our path array.
let currentPoint = 1

exports.givePath = (name, reverse, vendor) => {
  vendor_run = vendor || false
  debug('CURRENT PATH', name)
  curr_path = name
  let ourPath = JSON.parse(fs.readFileSync(pathModule.resolve(__dirname, file_path + name + '.json')))
  if (reverse) {
    exports.assignPath(ourPath[name].reverse())
  } else {
    exports.assignPath(ourPath[name])
  }
}

// Assigns an array of coordinates to their respective [x,y] positions to be used in our next roaming path
exports.assignPath = (coordinates, indexStart = 1) => {
  const distance = (x1, y1, x2, y2) => {
    let xDistSq = Math.pow(x2 - x1, 2)
    let yDistSq = Math.pow(y2 - y1, 2)
    return Math.sqrt(xDistSq + yDistSq)
  }

  let nearest_point = {
    index: 0,
    distance: 9999,
  }

  coordinates.map((point, i) => {
    const this_dist = distance(data.info.xcoord, data.info.ycoord, point[0], point[1])
    if (this_dist < nearest_point.distance) {
      nearest_point.index = i
      nearest_point.distance = this_dist
    }
  })

  debug(nearest_point)
  debug(coordinates)
  robot.setKeyboardDelay(0) // default delay time
  // store last path travel so it can be recalled
  previousPath = path.slice()
  path = []
  path.length = 0
  path = coordinates.slice()
  total_waypoints = coordinates.length - 1
  // Resets the currentPoint counter when we start a new path
  debug(nearest_point.index, coordinates.length)
  currentPoint = nearest_point.index == coordinates.length - 1 ? 0 : nearest_point.index
  // stores variables from path array into x,y coords
  for (i = 0; i < path.length; i++) {
    pathx[i] = path[i][0] //stores x coord
    pathy[i] = path[i][1] //stores y coord
    direction[i] = path[i][2] //stores direction
    zone[i] = path[i][3] //stores zone
  }
}

// Converts from degrees to radians.
Math.degToRad = function (degrees) {
  return (degrees * Math.PI) / 180
}

// Converts from radians to degrees.
Math.radToDeg = function (radians) {
  return (radians * 180) / Math.PI
}

Math.pointDistance = (x1, y1, x2, y2) => {
  let xDistSq = Math.pow(x2 - x1, 2)
  let yDistSq = Math.pow(y2 - y1, 2)
  return Math.sqrt(xDistSq + yDistSq)
}

class TurningControl {
  constructor() {
    this.turnTimeout = null
    this.turnKey = null
  }
  // This is a helper that does the actual turning. It is split into two phases:
  // * Turning the bulk amount of time using `setTimeout` (specifically time - 10ms)
  // * Turning the last 10ms using busy-waiting loop and process.hrtime
  askTurn(time, key) {
    if (can_turn) {
      can_turn = false
      robot.keyToggle(key, 'down')
      debug('turning', time)
      this.turnKey = key
      DEBUGGING && console.time('actual time')

      setTimeout(() => {
        robot.keyToggle(key, 'up')
        // robot.keyToggle('s', 'down')
        walkingControl.startWalking()
        DEBUGGING && console.timeEnd('actual time')
        can_turn = true
      }, time - 150) // -150 cus robot.js delay
    }
  }
  // Can be removed and consolidated to askTurn(t,"key")
  askTurnLeft(time) {
    this.askTurn(time, 'a')
  }
  // Can be removed and consolidated to askTurn(t,"key")
  askTurnRight(time) {
    this.askTurn(time, 'd')
  }
  stop() {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout)
      // lift previous key
      robot.keyToggle(this.turnKey, 'up')
      debug('STOPPING')
    }
  }
}
let turningControl = new TurningControl()
exports.turningControl = turningControl

// Tracks which keys are pressed down in regards to forwards/backwards
// Also presses the necessary keys down ("w" or "s")
class WalkingControl {
  constructor() {
    this.s = false
    this.x = false
  }

  startWalking() {
    if (!paused) {
      if (this.x) {
        robot.keyToggle('x', 'up')
      }
      if (!this.s) {
        robot.keyToggle('s', 'down')
      }
      this.s = true
      this.x = false
    }
  }

  startWalkingBackwards() {
    if (this.s) {
      robot.keyToggle('s', 'up')
    }
    if (!this.x) {
      robot.keyToggle('x', 'down')
    }
    this.x = true
    this.s = false
  }

  stop() {
    if (this.s) {
      robot.keyToggle('s', 'up')
    }
    if (this.x) {
      robot.keyToggle('x', 'up')
    }
    this.s = false
    this.x = false
  }
}
let walkingControl = new WalkingControl()

class StuckPrevention {
  // Stores current x,y positions so we may compare them to a future x,y pos to make sure we aren't stuck.
  constructor(x, y) {
    this.lastX = x
    this.lastY = y
    this.stoppedUpdatesCount = 0
    // Becomes set to true when StuckPrevention starts controlling
    // the character
    this.unstuckingActive = false

    this.unstuckProgress = 0
  }
  isStuck() {
    return this.unstuckingActive
  }
  // Passive means not currently unstucking, just check that we're making progress
  passiveUpdate(newX, newY) {
    let distanceTraveled = Math.pointDistance(this.lastX, this.lastY, newX, newY)

    this.lastX = newX
    this.lastY = newY

    if (distanceTraveled < exports.UNSTUCK.STUCK_DISTANCE) {
      this.stoppedUpdatesCount += 1
    } else {
      this.stoppedUpdatesCount = 0
    }

    if (this.stoppedUpdatesCount > 20) {
      debug('Got stuck!')
      this.unstuckingActive = true
      // Immediately trigger one active update step
      this.activeUpdate(newX, newY)
    }
  }
  // Active means currently in the middle of unstucking routine, control the player
  activeUpdate(newX, newY) {
    if (this.unstuckProgress === 0) {
      debug('Unstucking...')
      Math.round(Math.random()) == 1 && robot.keyTap('space')

      walkingControl.startWalkingBackwards()
      // ## Need to randomize time and also add right turn unstucking.
      turningControl.askTurnLeft(500)
      this.unstuckProgress++
    } else if (this.unstuckProgress === exports.UNSTUCK.STUCK_BACKWARDS_UPDATES_COUNT) {
      debug('Assumed unstuck, resuming...')
      this.unstuckProgress = 0
      this.unstuckingActive = false
      walkingControl.startWalking()
    } else {
      this.unstuckProgress++
    }
  }
  update(newX, newY) {
    if (this.unstuckingActive) this.activeUpdate(newX, newY)
    else this.passiveUpdate(newX, newY)
  }
}
let stuckPrevention = new StuckPrevention(0, 0)

// This replaces turns over 180 degrees into smaller turns in the opposite direction
// In other words, expresses the same turn more efficiently
let shortenDirectionDiff = directionDiff => {
  if (directionDiff > Math.PI) directionDiff = (Math.PI * 2 - directionDiff) * -1
  if (directionDiff < -Math.PI) directionDiff = Math.PI * 2 - directionDiff * -1
  return directionDiff
}

// WoW coordinate system has direction "0" pointing at a 90 degree angle
// to regular coordinates, so we need to rotate it and then do the modulo
// so that the final direction result is in 0-2PI range.
let calculateWowDirection = (playerX, playerY, targetX, targetY) => {
  let slope = Math.atan2(targetY - playerY, playerX - targetX)
  // slope is the absolute direction to the next point from the player
  slope += Math.PI // map to 0-2PI range
  // Rotate by 90 degrees (so that 0 is up, not right)
  slope -= Math.PI * 0.5
  // Ensures that slope is not less than 0
  if (slope < 0) {
    slope += Math.PI * 2
  }
  // Ensures slope is not greater than 2p
  if (slope > Math.PI * 2) {
    slope -= Math.PI * 2
  }
  return slope
}

exports.walkToCorpse = (px, py, accuracy, callback, ROAMSETTINGS) => {
  paused = false
  walking_towards_corpse = true
  debug('lets walk to corpse bois')
  if (ROAMSETTINGS) {
    ROAMVAR = ROAMSETTINGS
  }
  walkingControl.startWalking()
  let navigationFunction = selfInterval => {
    let distanceToPoint = Math.pointDistance(data.info.xcoord, data.info.ycoord, px, py)
    // if we're close enough, mark the point and move to the next one
    if (distanceToPoint < 0.01) {
      debug('REACHED CORPSE')
      walking_towards_corpse = false
      // debug('walkTo: Reached point (' + px + ', ' + py + ')')
      clearInterval(selfInterval)
      setImmediate(callback)
      return
    }
    // calculates number of degrees in radians between current point and next point
    // Y needs to be flipped because it's negative-y - up.
    let slope = calculateWowDirection(data.info.xcoord, data.info.ycoord, px, py)

    // Determines how much our character will be turning based on our direction as well as the where the next point is
    let directionDiff = slope - data.info.direction
    directionDiff = shortenDirectionDiff(directionDiff)

    // Calculates the amount of time needed to turn in order to get to our desired slope
    // The final static value refers to how much time (ms) is required to walk in a full circle
    let turnTime = (Math.radToDeg(directionDiff) / 360) * 2635

    // Stop to do big turns
    if (Math.abs(turnTime) > (vendor_run ? 300 : 500)) {
      // debug('px', px, 'py', py)
      // debug('Making a correcting turn')
      turnTime = (Math.radToDeg(directionDiff) / 360) * 2000 // ROAMVAR.CORRECTING_TURN_TIME_FACTOR
      // debug('px', px, 'py', py)
      walkingControl.stop()
    } else {
      walkingControl.startWalking()
    }

    // Do the actual turn, avoiding turns that are too small
    if (Math.abs(turnTime) > ROAMVAR.MINIMUM_TURN_TIME_MS) {
      // If turnTime is positive, make left turn
      if (turnTime > 0) {
        turningControl.askTurnLeft(turnTime)
        // If negative value, function makes a right turn
      } else if (turnTime < 0) {
        // Converts negative time into positive for setTimeout in turnRightWowFinish
        turnTime = Math.abs(turnTime)
        turningControl.askTurnRight(turnTime)
      }
    }
  }
  let it = setInterval(() => {
    // Every set time, we assess the current progress
    if (resetRoamer) {
      clearInterval(it)
      resetRoamer = false
      return
    }
    if (paused) {
      return
    }
    // If we detect that we got stuck, trigger the unstuck routine
    stuckPrevention.update(data.info.xcoord, data.info.ycoord)
    // If everything is going fine, just proceed with normal navigation:
    if (!stuckPrevention.isStuck()) {
      navigationFunction(it)
    }
  }, ROAMVAR.NAVIGATION_FUNCTION_INTERVAL)
}

// This function starts walking toward the point (px,py), and fires a callback when it reaches it.
// It works asynchronously, doing the corrections every NAVIGATION_FUNCTION_INTERVAL milliseconds.
exports.walkTo = (px, py, accuracy, callback, ROAMSETTINGS) => {
  if (ROAMSETTINGS) {
    ROAMVAR = ROAMSETTINGS
  }
  walkingControl.startWalking()
  // let distanceAccuracy = vendor_run ? 0.005 : 0.01 //if its very narrow stuff, inside buildings
  let distanceAccuracy = vendor_run ? 0.01 : 0.01
  let minTurnTime = accuracy === 'fine' ? ROAMVAR.MINIMUM_TURN_TIME_MS / 3 : ROAMVAR.MINIMUM_TURN_TIME_MS
  let navigationFunction = selfInterval => {
    if (walking_towards_corpse) {
      return
    }
    let distanceToPoint = Math.pointDistance(data.info.xcoord, data.info.ycoord, px, py)
    // if we're close enough, mark the point and move to the next one
    if (distanceToPoint < distanceAccuracy) {
      // debug('walkTo: Reached point (' + px + ', ' + py + ')')
      clearInterval(selfInterval)
      setImmediate(callback)
      return
    }
    // calculates number of degrees in radians between current point and next point
    // Y needs to be flipped because it's negative-y - up.
    let slope = calculateWowDirection(data.info.xcoord, data.info.ycoord, px, py)

    // Determines how much our character will be turning based on our direction as well as the where the next point is
    let directionDiff = slope - data.info.direction
    directionDiff = shortenDirectionDiff(directionDiff)

    // Calculates the amount of time needed to turn in order to get to our desired slope
    // The final static value refers to how much time (ms) is required to walk in a full circle
    let turnTime = (Math.radToDeg(directionDiff) / 360) * 2635

    // Stop to do big turns
    if (Math.abs(turnTime) > (vendor_run ? 190 : 500)) {
      // debug('px', px, 'py', py)
      // debug('Making a correcting turn')
      turnTime = (Math.radToDeg(directionDiff) / 360) * 2000 // ROAMVAR.CORRECTING_TURN_TIME_FACTOR
      // debug('px', px, 'py', py)
      walkingControl.stop()
    } else {
      walkingControl.startWalking()
    }

    // Do the actual turn, avoiding turns that are too small
    if (Math.abs(turnTime) > ROAMVAR.MINIMUM_TURN_TIME_MS) {
      // If turnTime is positive, make left turn
      if (turnTime > 0) {
        turningControl.askTurnLeft(turnTime)
        // If negative value, function makes a right turn
      } else if (turnTime < 0) {
        // Converts negative time into positive for setTimeout in turnRightWowFinish
        turnTime = Math.abs(turnTime)
        turningControl.askTurnRight(turnTime)
      }
    }
  }
  // This construct allows the navigation function to break its own interval loop
  let it = setInterval(() => {
    // Every set time, we assess the current progress
    if (resetRoamer) {
      clearInterval(it)
      resetRoamer = false
      return
    }
    if (paused) {
      return
    }
    // If we detect that we got stuck, trigger the unstuck routine
    stuckPrevention.update(data.info.xcoord, data.info.ycoord)
    // If everything is going fine, just proceed with normal navigation:
    if (!stuckPrevention.isStuck()) {
      navigationFunction(it)
    }
  }, ROAMVAR.NAVIGATION_FUNCTION_INTERVAL)
}

let keepWalkingZoneChange = zone => {
  return new Promise((res, na) => {
    //if current zone is one of the 5 major cities, change the roamer navigation variables to accomodate the new coordinate system
    ROAMVAR = zoneList.includes(zone) ? navVariables.special : navVariables.default
    setTimeout(() => {
      res()
    }, 1500)
  })
}

// Starts walking on the currectly selected path
exports.walkPath = callback => {
  exports.resumeNavigation()
  // This "loops" until we traverse all points
  let lastPointZone = zone[currentPoint] // stores lastPoints zone info , to check when zone changes
  // Load navigation variables corresponding to the zone
  ROAMVAR = zoneList.includes(lastPointZone) ? navVariables.special : navVariables.default
  let reachedPointCallback = async () => {
    currentPoint++
    // If we have reached the end of the path
    if (currentPoint >= path.length) {
      setImmediate(callback)
      //   navigationActive = false
      //   walkingControl.stop()
      debug('FINAL POINT')
      currentPoint = 1
      // return
    }
    let nextPointX = pathx[currentPoint]
    let nextPointY = pathy[currentPoint]
    // let accuracy = currentPoint === path.length ? 'fine' : 'coarse' // glutch
    let accuracy = 'coarse'
    lastPointZone = zone[currentPoint]
    exports.walkTo(nextPointX, nextPointY, accuracy, reachedPointCallback)
  }
  navigationActive = true
  reachedPointCallback()
}

exports.resumeNavigation = () => {
  debug('Resuming navigation')
  robot.setKeyboardDelay(10)
  paused = false
  navigationActive = true
  walkingControl.startWalking()
}

exports.pauseNavigation = () => {
  debug('Stopping navigation')
  robot.setKeyboardDelay(10)
  paused = true
  navigationActive = false
  walkingControl.stop()
}

exports.ChangeToDeathRun = state => {
  deathrun = state
}

exports.ResetRoamer = () => {
  resetRoamer = true
}

exports.isNavigationActive = () => navigationActive

let getRandom = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

exports.current_point = () => currentPoint
exports.waypoints = () => path

/*
Roamer Navigation Variables

NEAREST_POINT_THRESHOLD : --

NAVIGATION_FUNCTION_INTERVAL : How often in miliseconds the roaming function checks for being stuck

POINT_DISTANCE_ERROR : The radius we need to be within the targeted point before the next point is navigated to

POINT_FINE_DISTANCE_ERROR : Plus or minus the correct distance to be considered the correct turn if we are making a "fine" turn

TURN_TIME_FACTOR : Used to minimize turn time by dividing the total time it takes to run in a circle (2635ms). Only change the second variable.

CORRECTING_TURN_TIME_FACTOR : Used to minimize turns we make while standing in place (2000ms is totla time it takes to turn 365 degrees standing in place)

MINIMUM_CORRECTING_TURN_TIME_MS : Minimum required turn time before the character fully stops and makes a turn

MINIMUM_TURN_TIME_MS : Total amount of time calculated to be required in order for us to make a turn at all. Otherwise continues walking without turning.


Unstucking Config

STUCK_DISTANCE : how close a distance is considered "not moving"

STUCK_BACKWARDS_UPDATES_COUNT : how many updates we're moving back

BLINK_WHEN_VALID : Enable to blink when a point falls within a valid range for blinking

BLINK_STANDARD_ERROR : Blink degrees / rad error / 30degrees

BLINK_FORWARD_POINTS : Blink points to check further

BLINK_MANA_THRESHOLD : minimum mana in percent to blink

BLINK_JUMP_DISTANCE : BLINK distance -> used to find which point to blink to
*/

// MOONGLADE has a coordinate system less dense than orgrimmar but more dense than the default.
