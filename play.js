const robot = require('robotjs')
const roam = require('./NodeGameBot/Engine/roamer')
const data = require('./NodeGameBot/Engine/data')
const {keys} = require('regenerator-runtime')
const sleep = require('util').promisify(setTimeout)

robot.moveMouse(500, 500)
robot.mouseClick()

let paused_navigation = false
let serpting_sting_applied = false
let hunters_mark_applied = false
let melee_range = false
let pulled = false
let has_looted = false
let is_looting = false
let walking_towards_mob = false
let combat_routine_rate = 1000
let can_do_escape_routine = true
let no_target_count = 0

const combat_routine = () => {
  if (true) {
    setInterval(() => {
      const {mana, bagIsFull, target, playerInCombat, targetInCombat, targetIsDead, range, targetMaxHealth, targetCurrentHealth, targetOfTargetIsPlayer} = data.info
      const targetHealthPct = Math.round((data.info.targetCurrentHealth / data.info.targetMaxHealth) * 100) || 0

      const {serpentsting, arcaneshot} = data.info.spell

      // console.log({
      //   paused_navigation,
      //   serpting_sting_applied,
      //   hunters_mark_applied,
      //   melee_range,
      //   pulled,
      //   has_looted,
      //   is_looting,
      //   walking_towards_mob,
      //   combat_routine_rate,
      // })

      // console.log("");
      // console.log("target:", target);
      // console.log("playerInCombat:", playerInCombat);
      // console.log("targetInCombat:", targetInCombat);
      // console.log("targetIsDead:", targetIsDead);
      // console.log("range:", range);
      // console.log("targetMaxHealth:", targetMaxHealth);
      // console.log("targetCurrentHealth:", targetCurrentHealth);
      // console.log("targetHealthPct:", targetHealthPct);
      // console.log('targetOfTargetIsPlayer:', data.targetOfTargetIsPlayer)

      // console.log(data.spell.serpentsting);

      // console.log("serpting_sting_applied", serpting_sting_applied);

      if (!target && !is_looting) {
        robot.keyTap('tab')
      }

      console.log(target)

      if (target && !targetIsDead) {
        no_target_count = 0
        robot.keyTap('t') // ensure auto cast is on
        if (range == 50) {
          if (!hunters_mark_applied && serpentsting.castable) {
            pulled = true
            hunters_mark_applied = true
            robot.keyTap('g')
          }
          if (can_do_escape_routine) {
            walking_towards_mob = true
            robot.keyTap('j')
          }
        }
        // if (!targetOfTargetIsPlayer && range == 50 && targetInCombat) {
        //   melee_range = true
        //   robot.keyToggle('x', 'down')
        // }

        if (range == 5) {
          melee_range = true
          console.log('target too close')
          robot.keyToggle('x', 'down')
          // if (can_do_escape_routine) {
          //   can_do_escape_routine = false
          //   ;(async () => {
          //     await sleep(5 * 1000)
          //     can_do_escape_routine = true
          //   })()
          //   // Math.floor(Math.random() * (max - min + 1)) + min
          //   robot.keyTap('7')
          //   robot.keyToggle('a', 'down')
          //   const escape_duration = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000
          //   setTimeout(() => {
          //     robot.keyToggle('a', 'up')
          //     robot.keyToggle('u', 'down')
          //     Math.round(Math.random()) == 1 && robot.keyTap('space')
          //   }, 350)
          //   setTimeout(() => {
          //     robot.keyTap('space')
          //   }, Math.floor(Math.random() * (1500 - 1000 + 1)) + 1000)
          //   setTimeout(() => {
          //     robot.keyToggle('u', 'up')
          //     robot.keyTap('j')
          //   }, escape_duration)
          //   setTimeout(() => {
          //     robot.keyToggle('d', 'down')
          //   }, escape_duration + 200)
          //   setTimeout(() => {
          //     robot.keyToggle('d', 'up')
          //   }, escape_duration + 400)
          // }
        }

        if (melee_range) {
          if (range == 35) {
            melee_range = false
            robot.keyToggle('x', 'up')
          }
        }

        console.log(range)

        if (targetHealthPct < 10) {
          robot.keyTap('j')
          walking_towards_mob = true // maybe idk havent tåt about it
        }

        if (range == 35) {
          if (walking_towards_mob) {
            walking_towards_mob = false
            robot.keyTap('s')
          }
          if (targetHealthPct > 50) {
            if (!serpting_sting_applied && serpentsting.castable) {
              serpting_sting_applied = true
              ;(async () => {
                await sleep(15 * 1000)
                serpting_sting_applied = false
              })()
              robot.keyTap('q')
            }
          }

          if (arcaneshot.castable) {
            robot.keyTap('w')
          }
        }
        return
      }

      if (pulled && !target) {
        robot.keyTap('9')
        hunters_mark_applied = false
        pulled = false
        hunters_mark_applied = false
      }

      if (target && targetIsDead && !has_looted && !is_looting) {
        robot.keyToggle('x', 'up') // sluta gå bakåt
        is_looting = true
        console.log('target died, looting')
        robot.keyTap('j')
        console.log('bagIsFull', bagIsFull)
        if (bagIsFull) {
          is_looting = false
          has_looted = true
          clear_target()
        }
        ;(async () => {
          await sleep(15 * 1000)
          is_looting = false
          has_looted = true
        })()
      }

      if (target && is_looting) {
        robot.keyTap('j')
        console.log('bagIsFull', bagIsFull)
        if (bagIsFull) {
          is_looting = false
          has_looted = true
          clear_target()
        }
        setTimeout(() => console.log('walking to corpse'), 200)
        return
      }

      if (!target && is_looting) {
        is_looting = false
        console.log('finished looting')
        resume_path()
        return
      }

      if (target && targetIsDead && has_looted) {
        console.log('clearing target, final function in loop')
        clear_target()
        resume_path()
      }

      if (!target) {
        no_target_count++
        console.log('!target' + no_target_count)
        if (no_target_count >= 20) {
          clear_target()
          resume_path()
        }
      }
    }, combat_routine_rate)
  }
}

const resume_path = () => {
  if (paused_navigation) {
    console.log('resume path')
    roam.resumeNavigation()
    paused_navigation = false
    combat_routine_rate = 1000
  }
}

const clear_target = () => {
  robot.keyTap('8')
}

let walk = () => {
  // Give path accepts the name of the path as well as a 2nd parameter allowing the user to reverse the path.
  // The default behavior will not reverse the path:
  // roam.givePath("NameOfPath")
  // But adding any 2nd variable which evaluates to [true] will reverse the path:
  // roam.givePath("NameOfPath", true)
  roam.givePath('shit')

  // setTimeout(() => roam.pauseNavigation(), 2000)
  // setTimeout(() => roam.resumeNavigation(), 5000)

  // Uses a callback function to begin walking.
  combat_routine()
  roam.walkPath(() => {
    console.log('Finished Walking.')
    roam.givePath('shit')
    roam.resumeNavigation()
  })
}

setTimeout(() => {
  walk()
}, 500)
