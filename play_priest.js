const robot = require('robotjs')
const roam = require('./NodeGameBot/Engine/roamer')
const data = require('./NodeGameBot/Engine/data')
const {keys} = require('regenerator-runtime')
const sleep = require('util').promisify(setTimeout)

robot.moveMouse(500, 500)
robot.mouseClick()

let paused_navigation = false
let hunters_mark_applied = false
let pulled = false
let has_looted = false
let is_looting = false
let walking_towards_mob = false
let combat_routine_rate = 1000
let no_target_count = 0
let tried_to_cast = 0
let drinking = false
let healing = false
let staring_counter = 0
let can_cast_pws = true

const pause_nav = () => {
  if (!paused_navigation) {
    roam.pauseNavigation()
    paused_navigation = true
    combat_routine_rate = 100
  }
}

const rnd_btwn = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const cast_spell = keybind => {
  setTimeout(_ => robot.keyTap(keybind), rnd_btwn(200, 250))
  setTimeout(_ => robot.keyTap(keybind), rnd_btwn(300, 350))
  setTimeout(_ => robot.keyTap(keybind), rnd_btwn(400, 450))
  setTimeout(_ => robot.keyTap(keybind), rnd_btwn(500, 550))
  setTimeout(_ => {
    console.log('applying wand')
    robot.keyTap('j')
    setTimeout(_ => robot.keyTap('x'), 400)
    setTimeout(_ => robot.keyTap('t'), 600)
  }, 2050) //recast wand
}

const combat_routine = () => {
  if (true) {
    setInterval(() => {
      const {
        deadStatus,
        health,
        mana,
        bagIsFull,
        target,
        playerInCombat,
        targetInCombat,
        targetIsDead,
        range,
        targetMaxHealth,
        targetCurrentHealth,
        targetOfTargetIsPlayer,
        shadowwordpain,
        shielddebuff,
      } = data.info
      const targetHealthPct = Math.round((data.info.targetCurrentHealth / data.info.targetMaxHealth) * 100) || 0
      const {slot1, arcaneshot, heal, drinkWater, powerwordshield, slot5} = data.info.spell

      if (playerInCombat) {
        pulled = true
        pause_nav()
      }

      if (!target && !is_looting && !pulled && !deadStatus) {
        robot.keyTap('tab')
      }

      if (target && !targetIsDead) {
        if (!pulled && targetHealthPct == 100 && !targetInCombat) {
          pause_nav()
        }
        if (mana < 40 && !playerInCombat) {
          if (!drinkWater.active) {
            robot.keyTap('x')
            drinking = true
            setTimeout(x => robot.keyTap('z'), 300)
          }
        }
        if (drinking && mana > 95) {
          drinking = false
        }
        if (drinking) {
          return
        }

        no_target_count = 0

        if (tried_to_cast > 2 && targetHealthPct == 100) {
          robot.keyTap('j')
          setTimeout(() => {
            robot.keyTap('s')
            tried_to_cast = 0
          }, 300)
        }

        if (range == 50) {
          walking_towards_mob = true
          robot.keyTap('j')
          setTimeout(_ => robot.keyTap('r'), 2000)
        }

        if (health < 50 && heal.castable) {
          robot.keyTap('e')
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(400, 450))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(500, 550))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(600, 650))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(700, 750))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(800, 850))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(900, 950))
          setTimeout(_ => robot.keyTap('e'), rnd_btwn(1000, 1050))
          setTimeout(_ => robot.keyTap('t'), rnd_btwn(2800, 3000)) //recast wand
        }

        if (range == 30) {
          if (!pulled) {
            robot.keyTap('j')
            setTimeout(_ => robot.keyTap('s'), 400)
          }
          pulled = true

          if (walking_towards_mob) {
            // stop walking towards mob cus we in range bruh
            walking_towards_mob = false
            robot.keyTap('s')
          }

          // if (!powerwordshield.active && can_cast_pws) {
          //   console.log('applying shield')
          //   robot.keyTap('r')
          //   can_cast_pws = false
          //   setTimeout(_ => {
          //     console.log('applying wand')
          //     robot.keyTap('t')
          //   }, 1000) //recast wand
          // }

          if (!shadowwordpain) {
            console.log('applying swp')
            cast_spell('q')
          }

          if (!shielddebuff) {
            console.log('applying shield')
            cast_spell('r')
          }

          // if (arcaneshot.castable) {
          //   tried_to_cast++
          //   pulled = true
          //   robot.keyTap('w')
          //   ;(async () => {
          //     const current_spell_cast_time = 1.5
          //     await sleep(current_spell_cast_time * 3 * 1000)
          //     tried_to_cast = 10
          //   })()
          // }

          if (arcaneshot.notEnoughMana) {
            robot.keyTap('j')
          }
        }
        return
      }

      if (pulled && !target) {
        robot.keyTap('9') // target last target
      }

      if (target && targetIsDead && !has_looted) {
        pulled = false
        is_looting = true
        console.log('target died, looting')
        robot.keyTap('j')
        console.log('bagIsFull', bagIsFull)
        if (bagIsFull) {
          clear_target()
          resume_path()
        }
        // ;(async () => {
        //   await sleep(5 * 1000)
        //   is_looting = false
        //   has_looted = true
        //   pulled = false
        //   clear_target()
        // })()
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
        console.log('finished looting')
        resume_path()
        return
      }

      // if (target && targetIsDead && has_looted) {
      //   console.log('clearing target, final function in loop')
      //   clear_target()
      //   resume_path()
      // }

      // if (!target) {
      //   no_target_count++
      //   console.log('!target' + no_target_count)
      //   if (no_target_count >= 20) {
      //     clear_target()
      //     resume_path()
      //   }
      // }

      if (!target && !is_looting && !has_looted && combat_routine_rate < 1000) {
        staring_counter += combat_routine_rate
        if (staring_counter > 5 * combat_routine_rate) {
          resume_path()
          console.log('fuck it')
        }
      }
    }, combat_routine_rate)
  }
}

const resume_path = () => {
  if (paused_navigation) {
    console.log('resume path')
    roam.resumeNavigation()
    is_looting = false
    has_looted = true
    pulled = false
    paused_navigation = false
    combat_routine_rate = 1000
    clear_target()
  }
}

const clear_target = () => {
  tried_to_cast = 0
  staring_counter = 0
  has_looted = false
  robot.keyTap('8') // clear target
}

let walk = () => {
  roam.givePath('dunmoro')
  clear_target()
  combat_routine()
  roam.walkPath(() => {
    console.log('Finished Walking.')
    roam.givePath('dunmoro')
    roam.resumeNavigation()
  })
}

setTimeout(() => {
  walk()
}, 500)
