const robot = require('robotjs')
const roam = require('./NodeGameBot/Engine/roamer')
const data = require('./NodeGameBot/Engine/data')
const {keys} = require('regenerator-runtime')
const {clear} = require('console')
const sleep = require('util').promisify(setTimeout)

robot.moveMouse(500, 500)
robot.mouseClick()

// Global options
const SHOULD_LOOT = true
const SHOULD_VENDOR = true
const DEBUGGING = true

// Combat routine specific variables
let paused_navigation = false
let hunters_mark_applied = false
let pulled = false
let has_looted = false
let is_looting = false
let walking_towards_mob = false
let combat_routine_rate = 500
let tried_to_cast = 0
let drinking = false
let healing = false
let staring_counter = 0
let can_hunters_mark = true
let can_change_aspect = true
let can_feed_pet = true
let time_since_combat = 0
let time_since_pull = false
let skip_looting = false
let should_attack = false
let current_path = ''
let has_deathrun_completed = false
let tried_call_pet = false
let tried_to_cast_times = 0
let no_target_but_combat_counter = 0
let tried_to_loot_counter = 0
let tlt_counter = 0
let mobs_looted = 0
let backing_up = false
let healing_pet = false
let moving_to_vendor = false
let is_feign_deathing = false
let can_feign_death = true
let vendor_run_completed = false
let can_bestial_wrath = true
let closest_corpse_point = false
let is_walking_towards_corpse = false
let cleaned_bags_time = 0

const combat_routine = () => {
  if (true) {
    setInterval(() => {
      const {
        deadStatus: isDead,
        health,
        mana,
        target,
        playerInCombat,
        targetInCombat,
        targetIsDead,
        range,
        targetMaxHealth,
        targetCurrentHealth,
        targetOfTargetIsPlayer,
        serpentsting,
        isHuntersMarked,
        hasAspectHawk,
        isPetSad,
        hasAspectCheetah,
        IsTargetTooHighLevel,
        GetPetExists,
        isPetDead,
        isTargetMob,
        areBagsFull,
        needAmmo,
        getPetHp,
        TargetIsOurs,
        corpseX,
        corpseY,
        IsTargetElemental,
        IsPetInRange,
        ComboPoints,
        OutOfRange,
      } = data.info
      const targetHealthPct = Math.round((targetCurrentHealth / targetMaxHealth) * 100) || 0
      const {slot1, slot2, slot3, slot4, slot5} = data.info.spell

      if (areBagsFull && !isDead && !playerInCombat && SHOULD_LOOT && SHOULD_VENDOR) {
        if (roam.current_point() == 0) {
          if (!moving_to_vendor) {
            debug('changing to vendor path')
            moving_to_vendor = true
            roam.ResetRoamer()
            roam.givePath('gnome_vendor', false, true)
            roam.walkPath(() => {
              console.log('arrived at vendor from hunter.js')
              pause_nav()
              robot.keyTap('s')
              robot.keyTap('1')
              robot.keyTap('j')
              setTimeout(_ => {
                vendor_run_completed = true
                roam.ResetRoamer()
                roam.givePath('gnome_vendor', true, true)
                roam.walkPath(() => {
                  console.log('im back bitches')
                  roam.givePath('gnome')
                  roam.walkPath(() => console.log('continue as usual'))
                  moving_to_vendor = false
                })
              }, 5000)
            })
          }
        }
      }

      if (isDead) {
        if (current_path == 'gnome') {
          if (!closest_corpse_point) {
            closest_corpse_point = calculate_nearest_point_to_corpse(corpseX, corpseY)
          }
          if (roam.current_point() == closest_corpse_point) {
            if (!is_walking_towards_corpse) {
              is_walking_towards_corpse = true
              pause_nav()
              roam.walkToCorpse(corpseX, corpseY, 'coarse', () => {
                console.log('reached corpse')
                is_walking_towards_corpse = false
                pause_nav()
                resume_path()
              })
            }
          }
        }
        if (current_path != 'gnome_deathrun' && !has_deathrun_completed) {
          roam.ResetRoamer()
          roam.givePath('gnome_deathrun')
          current_path = 'gnome_deathrun'
          debug('changed path to gnome_deathrun')
          roam.walkPath(() => {
            debug('Finished deathrun.')
            debug('changed path to gnome from callback')
            has_deathrun_completed = true
            closest_corpse_point = false
            current_path = 'gnome'
            roam.ResetRoamer()
            roam.givePath('gnome')
            roam.walkPath(() => console.log('restart normal path'))
            roam.resumeNavigation()
          })
          roam.ChangeToDeathRun(true)
        }
      } else {
        if (has_deathrun_completed) {
          has_deathrun_completed = false
        }
      }

      console.log({OutOfRange})

      // IF NOT DEAD
      if (!isDead && !moving_to_vendor) {
        if (!playerInCombat && Date.now() > cleaned_bags_time + 30 * 1000) {
          debug('cleaned bags by pixel coordinate + bagnon')
          cleaned_bags_time = Date.now()
          robot.moveMouse(2934, 567)
          robot.mouseClick('left')
        }

        if (playerInCombat) {
          time_since_combat = Date.now()
          pause_nav()
          should_attack = true
        }

        if (playerInCombat && !target) {
          no_target_but_combat_counter++
          debug('playerInCombat && !target', no_target_but_combat_counter)
          // if (no_target_but_combat_counter > 3) {
          //   no_target_but_combat_counter = 0
          //   robot.keyTap('3')
          //   debug('target pet target 1')
          // }
        }

        if (!target && !is_looting && !pulled && !moving_to_vendor && !playerInCombat) {
          resume_path()
          robot.keyTap('tab')
        }

        if (playerInCombat && target && targetIsDead && pulled) {
          debug('im in combat but no target so sad')
        }

        if (target && !targetIsDead) {
          if (!TargetIsOurs) {
            clear_target()
            should_attack = false
          }

          if (playerInCombat) {
            should_attack = true
            pause_nav()
          }
          if (!isTargetMob) {
            debug('Target is not a mob, clearing')
            clear_target()
          }
          if (!pulled && targetInCombat && !playerInCombat && !moving_to_vendor) {
            debug('!pulled && targetInCombat && !playerInCombat, clearing')
            clear_target()
            return
          }
          if (IsTargetTooHighLevel == 1) {
            debug('Target too high level, clearing')
            clear_target()
            return
          }
          if (!pulled && !targetInCombat && IsTargetTooHighLevel == 0) {
            debug('Looks like a good target, should_attack = true')
            should_attack = true
            pause_nav()
          }

          if (should_attack) {
            if (range == 5) {
              console.log({ComboPoints})
              if (ComboPoints >= 3) {
                robot.keyTap('e')
                return
              }
              if (slot1.castable) {
                pulled = true
                robot.keyTap('s')
                robot.keyTap('j')
                robot.keyTap('q')
              }
            }

            if (range == 50) {
              walking_towards_mob = true
              debug('mob too far away, tap(j)')
              robot.keyTap('j')
            }
          }
        }
      }

      // not in combat do the after combat shit
      if (!playerInCombat) {
        if (SHOULD_LOOT) {
          if (pulled && !target) {
            debug('!playerInCombat && pulled && !target = TLT')
            robot.keyTap('9') // target last target
            tlt_counter++
            if (tlt_counter > 5) {
              debug('tried to target loot target 5 times, skipping loot')
              tlt_counter = 0
              resume_path()
              clear_target()
            }
          }

          if (target && targetIsDead && !has_looted) {
            debug('LOOTING: target && targetIsDead && !has_looted')
            if (areBagsFull) {
              debug('LOOTING: Bag is full, skipping loot')
              clear_target()
              resume_path()
            }
            pulled = false
            is_looting = true
            robot.keyTap('j')
          }

          if (target && targetIsDead && is_looting && !skip_looting) {
            debug('LOOTING: Moving towards corpse to loot')
            tried_to_loot_counter++
            if (tried_to_loot_counter > 40) {
              console.log('tried to loot 40 times, skipping')
              clear_target()
              resume_path()
              tried_to_loot_counter = 0
            }
            robot.keyTap('j')
            // if (bagIsFull) {
            //   debug('LOOTING: Bag is full (overkill?)')
            //   is_looting = false
            //   has_looted = true
            //   clear_target()
            // }
            return
          }

          if (!target && is_looting) {
            is_looting = false
            debug('LOOTING: finished looting')
            mobs_looted++
            // tel(mobs_looted)
            console.log({mobs_looted})
            resume_path()
            return
          }
        }

        if (!target && !is_looting && !has_looted && combat_routine_rate < 500 && !is_feign_deathing && !is_walking_towards_corpse) {
          staring_counter += combat_routine_rate
          // if (staring_counter > 10 * combat_routine_rate) {
          if (staring_counter > 8 * combat_routine_rate) {
            resume_path()
            debug('fuck it')
          }
        }
      }
    }, combat_routine_rate)
  }
}

const pause_nav = () => {
  if (!paused_navigation) {
    roam.pauseNavigation()
    paused_navigation = true
    combat_routine_rate = 50
  }
}

const rnd_btwn = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const cast_spell = keybind => {
  setTimeout(_ => robot.keyTap(keybind), rnd_btwn(0, 100))
}

const debug = message => {
  if (DEBUGGING) {
    console.log(message)
  }
}

const calculate_nearest_point_to_corpse = (corpseX, corpseY) => {
  const distance = (x1, y1, x2, y2) => {
    let xDistSq = Math.pow(x2 - x1, 2)
    let yDistSq = Math.pow(y2 - y1, 2)
    return Math.sqrt(xDistSq + yDistSq)
  }

  let nearest_point = {
    index: 0,
    distance: 9999,
  }

  roam.waypoints().map((point, i) => {
    const curr_point = distance(corpseX, corpseY, point[0], point[1])
    if (curr_point < nearest_point.distance) {
      nearest_point.index = i
      nearest_point.distance = curr_point
    }
  })

  console.log(nearest_point)
  console.log(roam.waypoints()[nearest_point.index])

  return nearest_point.index
}

const resume_path = () => {
  if (paused_navigation) {
    no_target_but_combat_counter = 0
    time_since_pull = false
    should_attack = false
    time_since_combat = Date.now()
    console.log('resume path')
    roam.resumeNavigation()
    is_looting = false
    has_looted = true
    pulled = false
    paused_navigation = false
    combat_routine_rate = 500
    clear_target()
  }
}

const clear_target = () => {
  console.log('CLEARING TARGET')
  should_attack = false
  tried_to_cast = 0
  staring_counter = 0
  has_looted = false
  robot.keyTap('8') // clear target
}

// const tel = async message => {
//   await fetch(`https://api.telegram.org/bot1812279682:AAFCMFYpraS-mZu6Uvnq7-TYaQpGTu-R7jI/sendMessage?chat_id=240403347&text=Mobs looted: ${message}`)
// }

let walk = async () => {
  console.log(data.info.xcoord, data.info.ycoord)
  // tel('hey')
  // roam.givePath('gnome_vendor', false, true)
  roam.givePath('gnome')
  clear_target()
  combat_routine()
  roam.walkPath(() => {
    console.log('Finished Walking.')
    roam.givePath('gnome')
    roam.resumeNavigation()
  })
}

setTimeout(() => {
  walk()
  console.log('starting in 2 seconds')
}, 2000)
