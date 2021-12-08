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
      } = data.info
      const targetHealthPct = Math.round((targetCurrentHealth / targetMaxHealth) * 100) || 0
      const {slot1, slot2, slot3, slot4, slot5} = data.info.spell

      if (Date.now() - time_since_combat > 20000 && !playerInCombat && !isDead && !target && !moving_to_vendor) {
        if (hasAspectCheetah == 0 && can_change_aspect) {
          debug('casting cheetah')
          clear_target()
          can_change_aspect = false
          robot.keyTap('4')
          setTimeout(_ => {
            can_change_aspect = true
          }, 3000)
        }
      }

      if (areBagsFull && !isDead && !playerInCombat && SHOULD_LOOT && SHOULD_VENDOR) {
        if (roam.current_point() == 0) {
          if (!moving_to_vendor) {
            debug('changing to vendor path')
            moving_to_vendor = true
            roam.ResetRoamer()
            roam.givePath('tanaris47to50_vendor', false, true)
            roam.walkPath(() => {
              console.log('arrived at vendor from hunter.js')
              pause_nav()
              robot.keyTap('s')
              robot.keyTap('1')
              robot.keyTap('j')
              setTimeout(_ => {
                vendor_run_completed = true
                roam.ResetRoamer()
                roam.givePath('tanaris47to50_vendor', true, true)
                roam.walkPath(() => {
                  console.log('im back bitches')
                  roam.givePath('tanaris47to50')
                  roam.walkPath(() => console.log('continue as usual'))
                  moving_to_vendor = false
                })
              }, 5000)
            })
          }
        }
      }

      if (moving_to_vendor && hasAspectCheetah) {
        robot.keyTap('4')
      }

      if (isDead && !is_feign_deathing) {
        if (current_path == 'tanaris47to50') {
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
        if (current_path != 'tanaris47to50_deathrun' && !has_deathrun_completed) {
          roam.ResetRoamer()
          roam.givePath('tanaris47to50_deathrun')
          current_path = 'tanaris47to50_deathrun'
          debug('changed path to tanaris47to50_deathrun')
          roam.walkPath(() => {
            debug('Finished deathrun.')
            debug('changed path to tanaris47to50 from callback')
            has_deathrun_completed = true
            closest_corpse_point = false
            current_path = 'tanaris47to50'
            roam.ResetRoamer()
            roam.givePath('tanaris47to50')
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

      // IF NOT DEAD
      if (!isDead && !moving_to_vendor) {
        if (isPetDead == 1 || GetPetExists == 0) {
          debug('pet dead, trying to fix')
          pause_nav()
          if (!tried_call_pet) {
            tried_call_pet = true
            debug('calling pet')
            robot.keyTap('f', 'shift')
            robot.keyTap('f', 'shift')
            setTimeout(_ => robot.keyTap('f', 'shift'), 100)
            setTimeout(_ => robot.keyTap('f', 'shift'), 230)
            setTimeout(_ => {
              if (!playerInCombat) {
                resume_path()
              }
              setTimeout(_ => {
                tried_call_pet = false
              }, 6000)
            }, 500)
          } else {
            robot.keyTap('t', 'shift')
            robot.keyTap('t', 'shift')
            setTimeout(_ => robot.keyTap('t', 'shift'), 100)
            setTimeout(_ => robot.keyTap('t', 'shift'), 230)
            setTimeout(_ => {
              if (!playerInCombat) {
                resume_path()
              }
              setTimeout(_ => {
                tried_call_pet = false
              }, 6000)
            }, 5500)
          }
          return
        }

        if (!playerInCombat && Date.now() > cleaned_bags_time + 30 * 1000) {
          debug('cleaned bags by pixel coordinate + bagnon')
          cleaned_bags_time = Date.now()
          robot.moveMouse(2934, 567)
          robot.mouseClick('left')
        }

        // IF NOT IN COMBAT
        if (isPetSad == 0 && can_feed_pet && !playerInCombat) {
          can_feed_pet = false
          robot.keyTap('6')
          debug('fed pet')
          setTimeout(_ => {
            can_feed_pet = true
          }, 5000)
        }

        if (playerInCombat) {
          time_since_combat = Date.now()
          pause_nav()
          should_attack = true
          // robot.keyTap('3') //target pets targetgjg
        }

        if (playerInCombat && !target) {
          no_target_but_combat_counter++
          debug('playerInCombat && !target', no_target_but_combat_counter)
          if (no_target_but_combat_counter > 3) {
            no_target_but_combat_counter = 0
            robot.keyTap('3')
            debug('target pet target 1')
          }
        }

        if (!target && !is_looting && !pulled && !moving_to_vendor && !playerInCombat) {
          resume_path()
          robot.keyTap('tab')
        }

        if (playerInCombat && target && targetIsDead && pulled) {
          robot.keyTap('3')
          debug('target pet target 2')
        }

        if (target && !targetIsDead) {
          // if (!TargetIsOurs) {
          //   if (!is_feign_deathing) {
          //     is_feign_deathing = true
          //     robot.keyTap('r', 'control')
          //     setTimeout(_ => {
          //       robot.keyTap('q', 'control')
          //       setTimeout(_ => {
          //         is_feign_deathing = false
          //         resume_path()
          //       }, 3000)
          //     }, 5500)
          //   }
          // }

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
            if (getPetHp < 40) {
              if (!IsPetInRange) {
                robot.keyTap('j')
              } else {
                if (!healing_pet) {
                  healing_pet = true
                  robot.keyTap('e')
                  setTimeout(_ => {
                    healing_pet = false
                  }, 4500)
                }
                return
              }
              return
            }

            if (health < 40 && can_feign_death) {
              robot.keyTap('q', 'control')
              robot.keyTap('q', 'control')
              setTimeout(_ => robot.keyTap('q', 'control'), 100)
              setTimeout(_ => robot.keyTap('q', 'control'), 230)
              can_feign_death = false
              is_feign_deathing = true
              setTimeout(_ => {
                is_feign_deathing = false
              }, 5 * 1000)
              setTimeout(_ => {
                can_feign_death = true
              }, 30 * 1000)
            }

            if (health < 90 && can_bestial_wrath) {
              robot.keyTap('g', 'shift')
              robot.keyTap('g', 'shift')
              setTimeout(_ => robot.keyTap('g', 'shift'), 100)
              setTimeout(_ => robot.keyTap('g', 'shift'), 230)
              can_bestial_wrath = false
              setTimeout(_ => {
                can_bestial_wrath = true
              }, 30 * 1000)
            }

            if (range == 5) {
              if (!backing_up) {
                robot.keyToggle('x', 'up')
                backing_up = true
                debug('target too close, backing up')
                robot.keyToggle('x', 'down')
                setTimeout(_ => {
                  debug('backing up complete')
                  robot.keyToggle('x', 'up')
                  robot.keyTap('t')
                  backing_up = false
                }, 3200)
              }
              return
            }

            if (IsPetInRange && (range == 50 || range == 5) && time_since_pull && Date.now() + 7000 > time_since_pull) {
              if (!backing_up) {
                robot.keyToggle('x', 'up')
                backing_up = true
                debug('target too close, backing up')
                robot.keyToggle('x', 'down')
                setTimeout(_ => {
                  debug('backing up complete')
                  robot.keyToggle('x', 'up')
                  robot.keyTap('t')
                  backing_up = false
                }, 3200)
              }
              return
            }

            if (range == 50) {
              walking_towards_mob = true
              if (!backing_up) {
                debug('mob too far away, tap(j)')
                robot.keyTap('j')
              }
              if (isHuntersMarked == 0) {
                debug('casting hunters mark')
                robot.keyTap('g')
                return
              }
              if (hasAspectHawk == 0) {
                debug('casting hawk')
                cast_spell('5')
                return
              }
            }

            if (range == 35) {
              // if (!backing_up) {
              //   robot.keyToggle('x', 'up')
              // }
              if (!pulled) {
                debug('range == 35 && !pulled = tap(s)')
                robot.keyTap('s')
                time_since_pull = Date.now()
              }
              pulled = true

              if (isHuntersMarked == 0) {
                debug('casting hunters mark')
                robot.keyTap('g')
                return
              }

              if (hasAspectHawk == 0) {
                cast_spell('5')
                debug('range == 35, casting hawk')
                return
              }

              if (!serpentsting && targetHealthPct > 30 && !IsTargetElemental) {
                debug('applying serpent')
                tried_to_cast_times++
                if (tried_to_cast_times > 3) {
                  debug('tried to apply serpent 3 times, turning towards mob')
                  setTimeout(_ => robot.keyTap('s'), 500)
                  robot.keyTap('j')
                  tried_to_cast_times = 0
                }
                cast_spell('q')
                robot.keyTap('t')
                return
              }

              if (targetHealthPct > 70 && slot2.castable) {
                debug('casting arcane shot')
                cast_spell('w')
              }
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
  // roam.givePath('tanaris47to50_vendor', false, true)
  roam.givePath('tanaris47to50')
  clear_target()
  combat_routine()
  roam.walkPath(() => {
    console.log('Finished Walking.')
    roam.givePath('tanaris47to50')
    roam.resumeNavigation()
  })
}

setTimeout(() => {
  walk()
  console.log('starting in 2 seconds')
}, 2000)
