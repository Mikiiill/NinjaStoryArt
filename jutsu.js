             
class StatusEffect {
    constructor(name, duration, damage = 0, startOfTurn = false, active = false, triggered = false, endOfTurn = false,
                startOfTurnFunction = null, activeFunction = null, triggeredFunction = null, endOfTurnFunction = null, emoji = null) {
        this.name = name;
        this.duration = duration;
        this.damage = damage;
        this.new = true;
        this.startOfTurn = startOfTurn;
        this.active = active;
        this.triggered = triggered;
        this.endOfTurn = endOfTurn;
        this.startOfTurnFunction = startOfTurnFunction;
        this.activeFunction = activeFunction;
        this.triggeredFunction = triggeredFunction;
        this.endOfTurnFunction = endOfTurnFunction;
        this.emoji = emoji; // Added to store the emoji
    }

    
    static get Substitute() {
        return (turns, damage) => new StatusEffect(
            "Substitute",
            turns, // Initial HP (e.g., 1)
            damage,
            false,
            false,
            true,
            false,
            null,
            null,
            async (target, user, skillStyle, damage) => {
                let status = target.statusEffects.find(e => e.name === "Substitute" && e.duration > 0);
                if (status) {
                    let incoming = (typeof damage === 'number' && !isNaN(damage)) ? damage : 1;
                    let absorbed = Math.min(status.duration, incoming);
                    //logBattle(`Substitute takes ${absorbed} damage! HP: ${status.duration - absorbed}`);
                    status.duration = Math.max(0, status.duration - absorbed);
                    if (status.duration <= 0) target.statusEffects = target.statusEffects.filter(e => e !== status);
                    updateBattleUI();
                    await sleep(2000);
                    return true;
                }
                return false;
            },
            null,
            statusEmojis["Substitute"]
        );
    }


    static get WaterClone() {
    return (turns, damage, barrageFunction) => new StatusEffect(
        "Water Clone",
        turns,
        damage,
        false,
        true,   // active = true
        true,   // triggered = true (for absorption)
        false,
        null,
        // Active function - Water Clone attacks with barrage + Wet interaction
        async (originalUser, target) => {
            let cloneCount = originalUser.statusEffects.filter(e => e.name === "Water Clone").length;
            if (cloneCount > 0) {
                for (let i = 0; i < cloneCount; i++) {
                    let status = originalUser.statusEffects.find((e, idx) => 
                        e.name === "Water Clone" && originalUser.statusEffects.indexOf(e) === i
                    );
                    if (status && status.duration > 0) {
                        let summon = new Mob(`Water Clone #${i + 1}`, status.duration, status.duration, "D-Rank", {}, [], [], []);
                        summon.summonType = true;
                        if (!originalUser.statusEffects.find(e => e.summon === summon)) {
                            originalUser.statusEffects.push({ name: "u", summon: summon, duration: status.duration });
                        }

                        logBattle(`<strong><span class="output-text-${originalUser === player ? 'player' : 'enemy'}">Water Clone  ${i + 1}</span></strong> uses <strong>barrage</strong> on <strong> ${target.name}</strong> ! 💧`);

                        updateBattleUI();
                        let originalGameUser = game.user;
                        game.user = summon;
                        await barrageFunction(summon, target);
                        game.user = originalGameUser;

                        if (DeathCheck()) return false;

                        // === Water Clone special effect after barrage ===
                        let wetIndex = target.statusEffects.findIndex(e => e.name === "Wet");
                        if (wetIndex !== -1) {
                            target.statusEffects[wetIndex].duration += 2;
                            logBattle(`<span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span>'s <span class="output-text-water">Wet</span> duration increased by 2! 💧`);
                        } else {
                            target.statusEffects.push(StatusEffect.Wet(3));
                            logBattle(`<span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span> becomes <span class="output-text-water">Wet</span> for 3 turns! 💧`);
                        }
                        updateBattleUI();

                        if (summon.hp <= 0) {
                            originalUser.statusEffects = originalUser.statusEffects.filter(e => e.summon !== summon);
                        }
                        await sleep(2000);
                    }
                }
                originalUser.statusEffects = originalUser.statusEffects.filter(e => 
                    e.name !== "u" || (e.summon && e.summon.hp > 0)
                );
            }
            return false;
        },
        // Triggered function - when clone blocks an attack, wet the attacker
        async (target, user, skillStyle, damage) => {
            let status = target.statusEffects.find(e => e.name === "Water Clone" && e.duration > 0);
            if (status) {
                let appliedDamage = (typeof damage === 'number' && !isNaN(damage)) ? damage : 1;
                let absorbed = Math.min(status.duration, appliedDamage);

                logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}">Water Clone</span></strong> takes <strong> ${absorbed} damage</strong>! <br><strong>clone hp: ${status.duration - absorbed} 💧</strong>`);

                status.duration = Math.max(0, status.duration - absorbed);
                if (status.duration <= 0) {
                    target.statusEffects = target.statusEffects.filter(e => e !== status);
                    logBattle(`<span class="output-text-\( {target === player ? 'player' : 'enemy'}">Water Clone removed!</span>`);

                    // === Water Clone death effect: wet the attacker ===
                    let attackerWetIndex = user.statusEffects.findIndex(e => e.name === "Wet");
                    if (attackerWetIndex !== -1) {
                        user.statusEffects[attackerWetIndex].duration += 2;
                        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> gets splashed! <span class="output-text-water">Wet</span> duration +2 💧`);
                    } else {
                        user.statusEffects.push(StatusEffect.Wet(3));
                        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> gets splashed and becomes <span class="output-text-water">Wet</span> for 3 turns! 💧`);
                    }
                    updateBattleUI();
                }
                updateBattleUI();
                await sleep(2000);
                return true;
            }
            return false;
        },
        null,
        statusEmojis["Water Clone"]
    );
    }

  
    static get ShadowClone() {
        return (turns, damage, barrageFunction) => new StatusEffect(
            "Shadow Clone",
            turns,
            damage,
            false,
            true, // Active function will trigger attacks
            true, // Triggered function for absorption
            false,
            null,
            async (originalUser, target) => {
                let cloneCount = originalUser.statusEffects.filter(e => e.name === "Shadow Clone").length;
                if (cloneCount > 0) {
                    for (let i = 0; i < cloneCount; i++) {
                        let status = originalUser.statusEffects.find((e, idx) => e.name === "Shadow Clone" && originalUser.statusEffects.indexOf(e) === i);
                        if (status && status.duration > 0) {
                            let summon = new Mob(`Shadow Clone #${i + 1}`, status.duration, status.duration, "D-Rank", {}, [], [], []);
                            summon.summonType = true;
                            if (!originalUser.statusEffects.find(e => e.summon === summon)) {
                                originalUser.statusEffects.push({ name: "u", summon: summon, duration: status.duration });
                            }
                            logBattle(`<strong><span class="output-text-\( {originalUser === player ? 'player' : 'enemy'}">shadow clone ${i + 1}</strong> uses <strong>barrage</strong> on <strong>${target.name}</strong> !</span>`);
                            updateBattleUI();
                            let originalGameUser = game.user;
                            game.user = summon;
                            await barrageFunction(summon, target);
                            game.user = originalGameUser;
                            if (DeathCheck()) return false;
                            //summon.hp = Math.max(0, summon.hp - 1);
                            if (summon.hp <= 0) {
                                originalUser.statusEffects = originalUser.statusEffects.filter(e => e.summon !== summon);
                                //logBattle(`<strong><span class="output-text-\( {originalUser === player ? 'player' : 'enemy'}">shadow clone $ {i + 1} is removed</strong> !</span>`);
                            }
                            await sleep(2000);
                        }
                    }
                    originalUser.statusEffects = originalUser.statusEffects.filter(e => 
                        e.name !== "u" || (e.summon && e.summon.hp > 0)
                    );
                }
                return false;
            },
            async (target, user, skillStyle, damage) => {
                let status = target.statusEffects.find(e => e.name === "Shadow Clone" && e.duration > 0);
                if (status) {
                    let appliedDamage = (typeof damage === 'number' && !isNaN(damage)) ? damage : 1;
                    let absorbed = Math.min(status.duration, appliedDamage);
                    logBattle(`<strong><span class="output-text-${target === player ? 'player' : 'enemy'}">shadow clone</span></strong> takes <strong>${absorbed} damage</strong>! <br><strong>clone hp: ${status.duration - absorbed} 👥</strong>`);
                    status.duration = Math.max(0, status.duration - absorbed);
                    if (status.duration <= 0) {
                        target.statusEffects = target.statusEffects.filter(e => e !== status);
                        logBattle(`<span class="output-text-${target === player ? 'player' : 'enemy'}"> target <strong>shadow clone removed</strong>!</span>`);
                    }
                    updateBattleUI();
                    await sleep(2000);
                    return true;
                }
                return false;
            },
            null,
            statusEmojis["Shadow Clone"]
        );
                    }





        // FIXED StatusEffect.sling static getter - now properly triggers barrage like Shadow Clone
static get sling() {
    return (turns) => new StatusEffect(
        "sling",
        turns,
        0,  // damage field unused
        false,
        true,  // hasActiveFunction = true (triggers on owner's turn)
        false,
        false,
        null,
        // Active function: runs on owner's turn, performs barrage on target (like Shadow Clone)
        async (owner, target) => {
            const skillsInstance = new Skills();  // Get skills instance for barrage
            logBattle(`<span class="output-text-earth"><strong>sling</strong></span> fires <strong>barrage</strong> at <strong>${target.name}</strong> 💥 !`);

            // Temporarily set game.user to owner for barrage execution
            const originalUser = game.user;
            game.user = owner;

            // Trigger barrage attack (exactly like Shadow Clone would)
            await skillsInstance.barrage(owner, target);

            // Restore original user
            game.user = originalUser;

            // Check for death after barrage
            if (DeathCheck()) return false;

            updateBattleUI();
            await sleep(1500);  // Brief pause for visual effect
        }
    );
}



    static Charged(duration, extraDamage = 1) {
    return new StatusEffect(
        "Charged",
        duration,
        extraDamage,        // this.damage stores how many EXTRA hits to add
        false,              // startOfTurn
        false,              // active
        false,              // triggered
        false,              // endOfTurn
        null,               // startOfTurnFunction
        null,               // activeFunction
        null,               // triggeredFunction
        null,               // endOfTurnFunction
        statusEmojis["Charged"]
    );
}





    static get Wet() {
    return (turns) => new StatusEffect(
        "Wet",
        turns,
        0,
        false,   // no startOfTurn
        false,   // no active
        false,   // no triggered
        true,    // endOfTurn = true  ← important
        null,
        null,
        null,
        // End of turn function - removes Burn and reduces Wet duration
        async (user, target, status) => {
            // Check both sides (user and target) like Recovered does
            const checkAndClean = (entity) => {
                const hasWet = entity.statusEffects.some(e => e.name === "Wet");
                const hasBurn = entity.statusEffects.some(e => e.name === "Burn");

                if (hasWet && hasBurn) {
                    // Remove Burn completely
                    entity.statusEffects = entity.statusEffects.filter(e => e.name !== "Burn");

                    // Reduce Wet duration by 1
                    let wetStatus = entity.statusEffects.find(e => e.name === "Wet");
                    if (wetStatus) {
                        wetStatus.duration = Math.max(0, wetStatus.duration - 1);
                        if (wetStatus.duration <= 0) {
                            entity.statusEffects = entity.statusEffects.filter(e => e.name !== "Wet");
                        }
                    }

                    logBattle(`<strong><span class="output-text-\( {entity === player ? 'player' : 'enemy'}"> ${entity.name}</span></strong> is <span class="output-text-water">Wet</span> and <span class="status-burn">Burn</span> cancels out! Wet duration reduced.`);
                    updateBattleUI();
                    return true;
                }
                return false;
            };

            let changed = false;
            if (checkAndClean(user)) changed = true;
            if (checkAndClean(target)) changed = true;

            await sleep(1500);
            return false; // don't end turn early
        },
        statusEmojis["Wet"] || "💦"   // fallback emoji if not defined
    );
}



    static get Doom() {
        return (turns, damage) => new StatusEffect(
            "Doom",
            turns,
            damage,
            true,
            false,
            false,
            false,
            async (user, target, status) => {
                user.hp = Math.max(0, user.hp - status.damage);
                logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> takes <strong>${status.damage} damage</strong> from <strong><span class="status-doom">doom 💀</span></strong> !`);
                updateBattleUI();
                if (DeathCheck()) return true;
                await sleep(2000);
                return false;
            },
            null,
            null,
            null,
            statusEmojis["Doom"]
        );
    }

    static get Regen() {
        return (turns, damage) => new StatusEffect(
            "Regen",
            turns,
            damage,
            true,
            false,
            false,
            false,
            async (user, target, status) => {
                let heal = user.hp < user.maxHp ? status.damage : 0;
                user.hp = Math.min(user.maxHp, user.hp + heal);
                if (heal > 0) {
                    logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> heals <strong>${heal} hp</strong> from <strong><span class="status-regen">regen 🌿</span></strong> !`);
                    updateBattleUI();
                    if (DeathCheck()) return true;
                    await sleep(2000);
                }
                return false;
            },
            null,
            null,
            null,
            statusEmojis["Regen"]
        );
    }

    static get Dome() {
        return (turns, damage) => new StatusEffect(
            "Dome",
            turns,
            damage,
            false,
            false,
            true,
            false,
            null,
            null,
            async (target, user, skillStyle, incomingDamage = 1) => {
                if (skillStyle !== "genjutsu") {
                    let status = target.statusEffects.find(e => e.name === "Dome" && e.duration > 0);
                    if (!status) return false;
                    logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span></strong> is protected by <strong>earth dome</strong> 🪨 !`);
                    status.duration = Math.max(0, status.duration - 1);
                    if (status.duration <= 0) {
                        target.statusEffects = target.statusEffects.filter(e => e !== status);
                        logBattle(`target <strong>earth dome 🪨 removed</strong> !`);
                    }
                    updateBattleUI();
                    await sleep(2000);
                    return true;
                }
                return false;
            },
            null,
            statusEmojis["Dome"]
        );
    }

    
    static get wildfire() {
    return (turns = 3) => new StatusEffect(
        "wildfire",
        turns,
        0,                      // damage field unused here
        false,                  // no start-of-turn
        true,                   // has active function (on owner's turn)
        true,                   // has triggered function (when attacked)
        false,                  // no end-of-turn
        null,                   // no start-of-turn func
        // Active function: runs on owner's turn → attacks target + burns both
        async (user, target) => {
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> lights an uncontrollable <strong><span class="output-text-neutral">wild fire</span> !</strong>`);
            updateBattleUI();
            await sleep(1000);

            let damage = 1;

            // Check target's triggered defenses (Substitute, Shadow Clone, etc.)
            const blocked = await TriggeredCheck(user, target, { style: "fire", name: "Wild Fire" }, damage);
                //logBattle(`<strong>Target's defense absorbs the <span class="output-text-neutral">wild fire</span> flame!</strong
            if (blocked) {
                //target.statusEffects.push(StatusEffect.Burn(1, 1));
                logBattle(`<strong>Target's defense absorbs the <span class="output-text-neutral">wild fire</span> flame!</strong>`);
            } else {
                target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
                logBattle(`<strong><span class="output-text-\( {owner === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> burns <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> for <strong>${damage} damage</strong> with <span class="output-text-neutral">wild fire</span> !</strong>`);
            }

            // Always apply Burn to target (even if damage blocked)
            target.statusEffects.push(StatusEffect.Burn(1, 1));
            logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span> gains <span class="status-burn">burn 🔥</span>!</strong>`);
            updateBattleUI();
            if (DeathCheck()) return true;
            await sleep(1500);

            // Self-burn penalty (user also gets Burn)
            user.statusEffects.push(StatusEffect.Burn(1, 1));
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> gains <span class="status-burn">burn 🔥 </span>!</strong>`);
            updateBattleUI();
            if (DeathCheck()) return true;
            await sleep(1500);

            return false;
        },
        // Triggered function: when the owner is attacked → self-burn
        async (target, user, skillStyle, incomingDamage) => {
            // target = the one with Wild Fire (being attacked)
            logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span>'s <span class="output-text-neutral">wild fire</span> flares !</strong>`);

            user.statusEffects.push(StatusEffect.Burn(1, 1));
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> gains <span class="status-burn">burn 🔥</span> <span class="output-text-neutral">wild fire</span>!</strong>`);
            updateBattleUI();

            if (DeathCheck()) return true;
            await sleep(1500);

            return false; // does NOT block/absorb incoming damage
        },
        null,                   // no end-of-turn
        statusEmojis["wildfire"]                   // emoji (you can change or use statusEmojis["Burn"])
    );
}


    static get Burn() {
        return (turns, damage) => new StatusEffect(
            "Burn",
            turns,
            damage,
            true,
            false,
            false,
            false,
            async (user, target, status) => {
                user.hp = Math.max(0, user.hp - status.damage);
                logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> takes <strong>${status.damage} damage</strong> from <strong><span class="status-burn">burn</strong> 🔥</span> !`);
                updateBattleUI();
                if (DeathCheck()) return true;
                await sleep(2000);
                return false;
            },
            null,
            null,
            null,
            statusEmojis["Burn"]
        );
    }

    static get Numb() {
        return (turns, damage) => new StatusEffect(
            "Numb",
            turns,
            damage,
            true,
            false,
            false,
            false,
            async (user, target) => {
                logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> is stunned by <strong><span class="status-numb">numb ⚡️</span></strong> and skips their turn!`);
                user.statusEffects = user.statusEffects.filter(e => e.name !== "Numb");
                updateBattleUI();
                await sleep(2000);
                return true;
            },
            null,
            null,
            null,
            statusEmojis["Numb"]
        );
    }
  
    static get Ready() {
    return (turns, damage = 0) => new StatusEffect(
        "READY",
        turns,
        damage,
        false,           // no start-of-turn
        true,            // active = yes (triggers on user's turn)
        false,           // not triggered (we'll handle breaking opponent's triggers manually)
        false,           // no end-of-turn
        null,
        async (user, target) => {
            // First: break any triggered defenses the target has (like Substitution, Dome, etc.)
            let brokeSomething = false;
            for (let status of target.statusEffects) {
                if (status.triggered && status.triggeredFunction) {
                    // Call the triggered function (usually checks style and blocks/absorbs)
                    const blocked = await status.triggeredFunction(target, user, "taijutsu"); // assuming taijutsu-style barrage
                    if (blocked) {
                        brokeSomething = true;
                    }
                    if (DeathCheck()) return true; // early exit if someone died
                    await sleep(1200);
                }
            }

            if (brokeSomething) {
                logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> is <strong><span class="status-ready">ready 💪</span></strong>!`);
            }

            // Then: unleash Barrage
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> unleashes a barrage <span class="status-ready">💪</span>!`);
            updateBattleUI();
            await sleep(1000);

            // Important: Use a properly bound barrage function
            const skills = new Skills(); // or better: pass skills instance if you have it globally
            await skills.barrage(user, target);

            if (DeathCheck()) return true;

            // Do NOT return true here → we want the normal turn to continue
            return false;
        },
        null,   // no triggered function needed (we handled breaking above)
        null,
        statusEmojis["READY"]
    );
} 
                

    static get Release() {
        return (turns, damage) => new StatusEffect(
            "Release",
            turns,
            damage,
            false,
            false,
            true,
            false,
            null,
            null,
            async (target, user, skillStyle) => {
                if (skillStyle === "genjutsu") {
                    logBattle(`<strong><span class="output-text-${target === player ? 'player' : 'enemy'}">${target.name}</span> target release removed<strong> !`);
                    target.statusEffects = target.statusEffects.filter(e => e.name !== "Release");
                    updateBattleUI();
                    await sleep(2000);
                    await endTurn();
                    return true;
                }
                return false;
            },
            null,
            statusEmojis["Release"]
        );
    }

    static get Bleed() {
        return (turns, damage) => new StatusEffect(
            "Bleed",
            turns,
            damage,
            true,
            false,
            false,
            false,
            async (user, target, status) => {
                user.hp = Math.max(0, user.hp - status.damage);
                logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> takes <strong>${status.damage} damage</strong> from <strong><span class="status-bleed">bleed 🩸</span></strong> !`);
                updateBattleUI();
                if (DeathCheck()) return true;
                await sleep(2000);
                return false;
            },
            null,
            null,
            null,
            statusEmojis["Bleed"]
        );
    }

    static get Recovered() {
        return (turns, damage) => new StatusEffect(
            "Recovered",
            turns,
            damage,
            false,
            false,
            false,
            true,
            null,
            null,
            null,
            async (user, target, status) => {
                const userHasBoth = game.user.statusEffects.some(e => e.name === "Numb") && game.user.statusEffects.some(e => e.name === "Recovered");
                const targetHasBoth = game.target.statusEffects.some(e => e.name === "Numb") && game.target.statusEffects.some(e => e.name === "Recovered");
                if (userHasBoth) {
                    game.user.statusEffects = game.user.statusEffects.filter(e => e.name !== "Numb" && e.name !== "Recovered");
                }
                if (targetHasBoth) {
                    game.target.statusEffects = game.target.statusEffects.filter(e => e.name !== "Numb" && e.name !== "Recovered");
                }
                updateBattleUI();
                await sleep(2000);
                return false;
            },
            statusEmojis["Recovered"]
        );
    }


    static get Dog() {
    return (turns, damage, biteFunction) => new StatusEffect(
        "Dog",
        turns,
        damage,
        false,
        true,   // active = true
        true,   // triggered = true
        false,
        null,
        // Active function - runs on owner's turn (this is what was missing/broken)
        async (owner, target) => {
            let dogCount = owner.statusEffects.filter(e => e.name === "Dog").length;
            if (dogCount > 0) {
                for (let i = 0; i < dogCount; i++) {
                    let status = owner.statusEffects.find((e, idx) => e.name === "Dog" && owner.statusEffects.indexOf(e) === i);
                    if (status && status.duration > 0) {
                        logBattle(`<strong><span class="output-text-${owner === player ? 'player' : 'enemy'}">Dog  ${i + 1}</span></strong> looks to its owner, <strong> ${user.name}</strong> ! 🐺`);

                        updateBattleUI();
                        await sleep(800);

                        // Call the real bite jutsu (this is the key part)
                        const originalUser = game.user;
                        game.user = owner;
                        await biteFunction(owner, target);
                        game.user = originalUser;

                        if (DeathCheck()) return false;
                        await sleep(1200);
                    }
                }
            }
            return false;
        },
        // Triggered function (absorption) - this part was already working
        async (target, user, skillStyle, damage) => {
            let status = target.statusEffects.find(e => e.name === "Dog" && e.duration > 0);
            if (status) {
                let absorbed = Math.min(status.duration, damage || 1);
                logBattle(`<strong>Dog</strong> absorbs <strong>${absorbed} damage</strong> 🐺`);
                status.duration = Math.max(0, status.duration - absorbed);
                if (status.duration <= 0) {
                    target.statusEffects = target.statusEffects.filter(e => e !== status);
                    logBattle(`Dog is defeated!`);
                }
                updateBattleUI();
                await sleep(1500);
                return true;
            }
            return false;
        },
        null,
        "🐺"
    );
    }
}

// Status Emojis (keep this after the StatusEffect class)
const statusEmojis = {
    "Substitute": "🪵",
    "sling": "☄️",
    "Shadow Clone": "👥",
    "Water Clone": "👥",
    "Doom": "💀",
    "Regen": "🌿",
    "Dome": "🪨",
    "wildfire": "🕯",
    "Burn": "🔥",
    "Wet": "💦",
    "Numb": "⚡️",
    "Charged": "🔋",
    "READY": "💪",
    "Release": "🌀",
    "Bleed": "🩸",
    "Recovered": "💫",
    "Dog": "🐺",
};

// Battle Skill Class
class BattleSkill {
    constructor(name, attributes, requirements, skillFunction, style, support, rank) {
        this.name = name;
        this.attributes = attributes || [];
        this.requirements = requirements || {};
        this.skillFunction = skillFunction;
        this.style = style;
        this.support = support || false;
        this.rank = rank;
    }
}

// Mob Class
class Mob {
    constructor(name, hp, maxHp, rank, fightingStyles, activeJutsu, inventory, statusEffects, sprite) {
        this.name = name;
        this.hp = hp;
        this.maxHp = maxHp;
        this.rank = rank;
        this.fightingStyles = fightingStyles;
        this.activeJutsu = activeJutsu || [];
        this.inventory = inventory || [];
        this.statusEffects = statusEffects || [];
        this.sprite = sprite || null;
        this.xp = 0;
        this.travelFightsCompleted = 0;
        this.lastVillage = "Newb Village";
    }
}

// Skills Class
class Skills {
    constructor() {
        this.skills = [];
        this.initializeSkills();
    }

    initializeSkills() {
        this.skills = [
            new BattleSkill("Barrage", ["Taijutsu"], {}, this.barrage.bind(this), "taijutsu", false, "D-Rank"),

            new BattleSkill("Kunai", ["Ninjutsu", "Taijutsu"], { Ninjutsu: "C-Rank", Taijutsu: "C-Rank" }, this.kunai.bind(this), "ninjutsu", false, "B-Rank"),


            new BattleSkill("Hydrate", ["Water"], { Water: "C-Rank" }, this.hydrate.bind(this), "water", true, "C-Rank"),

            new BattleSkill("Drowning Jutsu", ["Water"], { Water: "B-Rank" }, this.drowningJutsu.bind(this), "water", false, "B-Rank"),

            new BattleSkill("Kraken's Grasp", ["Genjutsu", "Water"], { Genjutsu: "C-Rank", Water: "C-Rank" }, this.krakensGrasp.bind(this), "genjutsu", true, "C-Rank"),
            new BattleSkill("Water Clone Jutsu", ["Ninjutsu", "Water"], { Ninjutsu: "C-Rank", Water: "C-Rank" }, this.waterCloneJutsu.bind(this), "ninjutsu", true, "B-Rank"),
            new BattleSkill("Heavy Storm Jutsu", ["Water", "Lightning"], { Water: "C-Rank", Lightning: "C-Rank" }, this.heavyStormJutsu.bind(this), "lightning", false, "C-Rank"),

            //new BattleSkill("Barrage", ["Taijutsu"], {}, this.barrage.bind(this), "taijutsu", false, "D-Rank"),




            new BattleSkill("Chain Lightning", ["Ninjutsu", "Lightning"], { Lightning: "B-Rank" }, this.chainLightning.bind(this), "lightning", false, "B-Rank"),


            new BattleSkill("Substitution Jutsu", [], { Ninjutsu: "D-Rank", Taijutsu: "D-Rank" }, this.substitutionJutsu.bind(this), "ninjutsu", true, "D-Rank"),
            new BattleSkill("Shadow Clone Jutsu", ["Ninjutsu"], { Ninjutsu: "C-Rank" }, this.shadowCloneJutsu.bind(this), "ninjutsu", true, "C-Rank"),
            new BattleSkill("Demonic Vision", ["Genjutsu"], { Genjutsu: "C-Rank" }, this.demonicVision.bind(this), "genjutsu", false, "C-Rank"),
            new BattleSkill("Healing Stance", ["Ninjutsu"], {}, this.healingStance.bind(this), "neutral", true, "D-Rank"),
            new BattleSkill("Earth Dome Jutsu", ["Earth", "Ninjutsu"], { Earth: "C-Rank" }, this.earthDomeJutsu.bind(this), "earth", true, "C-Rank"),
            new BattleSkill("Flame Throw Jutsu", ["Fire"], { Fire: "B-Rank" }, this.flameThrowJutsu.bind(this), "fire", false, "B-Rank"),
            new BattleSkill("Static Field Jutsu", ["Lightning", "Ninjutsu"], { Lightning: "C-Rank" }, this.staticFieldJutsu.bind(this), "lightning", false, "C-Rank"),
            new BattleSkill("Fireball Jutsu", ["Fire", "Ninjutsu"], { Fire: "C-Rank" }, this.fireballJutsu.bind(this), "fire", false, "C-Rank"),
            //new
            new BattleSkill("Razor Wind Jutsu", ["Ninjutsu", "Wind"], { Wind: "C-Rank" }, this.razorWindJutsu.bind(this), "wind", false, "C-Rank"),
            new BattleSkill("Wind Shuriken Jutsu", ["Wind"], { Wind: "B-Rank" }, this.windShurikenJutsu.bind(this), "wind", false, "B-Rank"),
          


           

            new BattleSkill("smoke bomb", ["Ninjutsu"], { Ninjutsu: "B-Rank" }, this.smokebomb.bind(this), "ninjutsu", true, "B-Rank"),
            new BattleSkill("fire tag", ["Ninjutsu", "Fire"], { Ninjutsu: "C-Rank", Fire: "C-Rank" }, this.firetag.bind(this), "ninjutsu", true, "B-Rank"),
            new BattleSkill("Dynamic Entry", ["Taijutsu"], { Taijutsu: "C-Rank" }, this.dynamicEntry.bind(this), "taijutsu", true, "C-Rank"),
            new BattleSkill("Falcon Drop", ["Taijutsu"], { Taijutsu: "B-Rank" }, this.falconDrop.bind(this), "taijutsu", false, "B-Rank"),
            new BattleSkill("Rock Smash Jutsu", ["Earth", "Taijutsu"], { Earth: "B-Rank" }, this.rockSmashJutsu.bind(this), "earth", false, "B-Rank"),
            new BattleSkill("Genjutsu Release", ["Genjutsu"], { Genjutsu: "B-Rank" }, this.genjutsuRelease.bind(this), "genjutsu", true, "B-Rank"),
            new BattleSkill("Lightning Spirit Jutsu", ["Lightning", "Ninjutsu"], { Lightning: "C-Rank", Ninjutsu: "C-Rank" }, this.lightningEdge.bind(this), "lightning", true, "B-Rank"),
            new BattleSkill("Bite", ["Beast"], { Beast: "C-Rank" }, this.bite.bind(this), "beast", false, "C-Rank"),
            new BattleSkill("Night Terror Jutsu", ["Genjutsu"], { Genjutsu: "B-Rank" }, this.nightTerrorJutsu.bind(this), "genjutsu", false, "B-Rank"),
            new BattleSkill("Wild Fire Jutsu", ["Fire", "Ninjutsu"], { Fire: "C-Rank", Ninjutsu: "C-Rank" }, this.wildFireJutsu.bind(this), "fire", true, "C-Rank"),
            new BattleSkill("Summon Dog", ["Beast"], { Beast: "C-Rank" }, this.summonDog.bind(this), "beast", true, "C-Rank"),
            new BattleSkill("Earth Tank Jutsu", ["Earth", "Ninjutsu"], { Earth: "B-Rank", Ninjutsu: "C-Rank" }, this.earthTank.bind(this), "earth", true, "A-Rank"),
            new BattleSkill("Bloodstream Barrage", ["Beast", "Taijutsu"], { Beast: "C-Rank", Taijutsu: "C-Rank" }, this.bloodstreamBarrage.bind(this), "beast", false, "C-Rank"),
            new BattleSkill("Hell Fire Jutsu", ["Genjutsu"], { Genjutsu: "B-Rank" }, this.hellFireJutsu.bind(this), "genjutsu", true, "B-Rank")
        ];
        if (this.skills.length === 0) {
            console.error("Skills initialization failed!");
            logBattle("Error: No skills initialized!");
        }
    }

    canUseSkill(mob, skill) {
        const result = Object.keys(skill.requirements).every(key => mob.fightingStyles[key] && compareRanks(mob.fightingStyles[key], skill.requirements[key]) >= 0);
        if (!result) {
            console.log(`Cannot use ${skill.name}: Requirements not met`, skill.requirements, mob.fightingStyles);
        }
        return result;
    }

    findSkill(name) {
        return this.skills.find(skill => skill.name === name);
    }

    async barrage(user, target) {
    let baseDamage = Math.floor(Math.random() * 2) + 1;
    let comboDamage = Math.floor(Math.random() * 2) + 1;
    let damage = baseDamage + comboDamage; // Full combo damage

    // Call TriggeredCheck before applying damage
    if (await TriggeredCheck(user, target, this, damage)) {
        // If blocked by summon (e.g., Log), log the absorption
        logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> <span class="output-text-neutral">barrage</span> is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false; // Exit early if blocked
    }

    // Apply base damage if not blocked
    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - baseDamage));
    logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> attacks <strong><span class="output-text-${target === player ? 'player' : 'enemy'}">${target.name}</span></strong> with <strong><span class="output-text-neutral">barrage</span></strong> for <strong>${baseDamage} damage</strong> !`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    if (target.hp > 0) {
        target.hp = Math.max(0, Math.min(target.maxHp, target.hp - comboDamage));
        logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> combos <strong>${target.name}</strong> for <strong>${comboDamage} damage</strong> !`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
    }
    return false;
}

    async substitutionJutsu(user, target) {
        user.statusEffects.push(StatusEffect.Substitute(1, 0));
        logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> gains <strong><span class="output-text-neutral">substitution</span></strong> <span class="status-substitution">🪵</span>!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return true;
    }

    async shadowCloneJutsu(user, target) {
    if (user.hp < 4) {
        logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> does not have enough <strong>hp</strong> to use <strong><span class="output-text-neutral">shadow clone jutsu</span></strong> !`);
        updateBattleUI();
        await sleep(2000);
        const skills = new Skills();
        await skills.barrage(user, target);
        return false;
    }
    let cloneCount = user.statusEffects.filter(e => e.name === "Shadow Clone").length;
    if (cloneCount >= 3) {
        logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> already has the maximum of 3 shadow clones!`);
        updateBattleUI();
        await sleep(2000);
        const skills = new Skills();
        await skills.barrage(user, target);
        return false;
    }
    user.hp = Math.max(0, Math.min(user.maxHp, user.hp - 3));
    logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> gains <strong>2<span class="output-text-neutral">shadow clone</span></strong> <span class="status-shadowcloneeffect">👥</span>!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    const skills = new Skills();

user.statusEffects.push(StatusEffect.ShadowClone(3, 0, skills.barrage.bind(skills)));    user.statusEffects.push(StatusEffect.ShadowClone(3, 0, skills.barrage.bind(skills)));
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}


     async waterCloneJutsu(user, target) {
    let cloneCount = user.statusEffects.filter(e => e.name === "Water Clone").length;
    if (cloneCount >= 3) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> already has the maximum of 3 clones!`);
        updateBattleUI();
        await sleep(2000);
        const skills = new Skills();
        await skills.barrage(user, target);
        target.statusEffects.push(StatusEffect.Wet(3));

        return false;
    }

    if (user.statusEffects.some(e => e.name === "Wet")) {
        // Remove Wet status as cost
        user.statusEffects = user.statusEffects.filter(e => e.name !== "Wet");
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> uses <strong><span class="output-text-water">Water Clone Jutsu</span></strong> and removes their <span class="output-text-water">Wet</span> status!`);
    } else {
        if (user.hp < 4) {
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> does not have enough <strong>hp</strong> to use <strong><span class="output-text-neutral">Water Clone Jutsu</span></strong> !`);
            updateBattleUI();
            await sleep(2000);
            const skills = new Skills();
            await skills.barrage(user, target);
            target.statusEffects.push(StatusEffect.Wet(3));

            return false;
        }
        user.hp = Math.max(0, Math.min(user.maxHp, user.hp - 3));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> loses 3 HP to create clones!`);
    }

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> gains <strong>2<span class="output-text-neutral">water clone</span></strong> <span class="status-shadowcloneeffect">👥</span>!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    const skills = new Skills();
    user.statusEffects.push(StatusEffect.WaterClone(3, 0, skills.barrage.bind(skills)));
    user.statusEffects.push(StatusEffect.WaterClone(3, 0, skills.barrage.bind(skills)));
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}


    async windShurikenJutsu(user, target) {
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> sends a spinning orb of Wind at <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> that hones in on their location !`);

    // Special Earth Dome interaction
    let domeIndex = target.statusEffects.findIndex(e => e.name === "Dome");
    if (domeIndex !== -1) {
        target.statusEffects[domeIndex].duration = Math.max(0, target.statusEffects[domeIndex].duration - 2);
        logBattle(`<span class="output-text-wind">Wind Shuriken</span> crashes into <span class="output-text-earth">Earth Dome</span>! Dome duration reduced by 2.`);

        if (target.statusEffects[domeIndex].duration <= 0) {
            target.statusEffects.splice(domeIndex, 1);
            logBattle(`<span class="output-text-earth">Earth Dome</span> is destroyed!`);
        }
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    // Normal hit (skips TriggeredCheck)
    let damage = Math.floor(Math.random() * 2) + 3; // 3-4 damage

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> hits <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> for <strong>${damage} damage</strong>!`);

    // Apply Bleed
    target.statusEffects.push(StatusEffect.Bleed(2, 1));
    logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> starts <span class="status-bleed">Bleeding 🩸</span> !`);

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
    }


    async razorWindJutsu(user, target) {
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> exerts a strong gust of wind hitting every thing in its path !`);

    // Reduce duration of all triggered status effects on target by 1
    target.statusEffects.forEach(status => {
        if (status.triggered && status.duration > 0) {
            status.duration = Math.max(0, status.duration - 1);
        }
    });

    // Clean up any expired triggered statuses
    target.statusEffects = target.statusEffects.filter(status => 
        !(status.triggered && status.duration <= 0)
    );

    updateBattleUI();
    await sleep(1000);

    // Deal 1-2 damage (skips TriggeredCheck as requested)
    let damage = Math.floor(Math.random() * 2) + 1;

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> slices <span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span> for <strong>${damage} damage</strong>!`);

    // Apply Bleed
    target.statusEffects.push(StatusEffect.Bleed(2, 1));
    logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> starts <span class="status-bleed">Bleeding 🩸</span>!`);

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
    }

  

    async demonicVision(user, target) {
    let damage = 1;

    if (await TriggeredCheck(user, target, this, damage)) {
        //logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Demonic Vision is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    target.statusEffects.push(StatusEffect.Doom(5, 1));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> uses <strong><span class="output-text-genjutsu">demonic vision</span></strong> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> for <strong>${damage} damage<strong><b>target gains <span class="status-doom">doom 💀</span>!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}


    async hydrate(user, target) {
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> uses <strong><span class="output-text-water">Hydrate</span></strong>!`);

    // Add Healing Stance for 3 turns (you'll need to make sure HealingStance status exists or adjust if needed)
    user.statusEffects.push(StatusEffect.Regen(3, 1));

    let wetIndex = user.statusEffects.findIndex(e => e.name === "Wet");
    if (wetIndex !== -1) {
        // Already wet → gain 1 HP and add 3 more turns
        user.hp = Math.max(0, Math.min(user.maxHp, user.hp + 1));
        user.statusEffects[wetIndex].duration += 3;
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> absorbs some water !`);
    } else {
        // Not wet → gain 3 HP and add Wet for 3 turns
        user.hp = Math.max(0, Math.min(user.maxHp, user.hp + 3));
        user.statusEffects.push(StatusEffect.Wet(3));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> heals 3 HP and becomes <span class="output-text-water">Wet</span> for 3 turns!`);
    }

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}


    async healingStance(user, target) {
        let heal = user.hp < user.maxHp ? 1 : 0;
        user.hp = Math.min(user.maxHp, user.hp + heal);
        user.statusEffects.push(StatusEffect.Regen(2, 1));
        logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}"><strong>${user.name}</span></strong> enters <strong><span class="output-text-neutral">healing stance</span>${heal > 0 ? `, healing ${heal} hp</strong> ` : ""} <span class="status-regen">🌿</span>!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return true;
    }



    async krakensGrasp(user, target) {
    //logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span></strong> uses <strong><span class="output-text-genjutsu">Kraken's Grasp</span></strong>!`);

    // Apply Doom
    target.statusEffects.push(StatusEffect.Doom(5, 1));

    // Apply Wet for 3 turns (or refresh)
    let wetIndex = target.statusEffects.findIndex(e => e.name === "Wet");
    if (wetIndex !== -1) {
        target.statusEffects[wetIndex].duration += 3;
    } else {
        target.statusEffects.push(StatusEffect.Wet(3));
    }

    logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> becomes soaked in sweat and nerves !`);

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
    }

  

    async drowningJutsu(user, target) {
    let damage = 3;
    let wetEffect = target.statusEffects.find(e => e.name === "Wet");

    if (wetEffect) {
        damage += wetEffect.duration;
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> uses <strong><span class="output-text-water">Drowning Jutsu</span></strong> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span>! The wet target takes <strong>${damage} damage</strong>!`);
    } else {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> uses <strong><span class="output-text-water">Drowning Jutsu</span></strong> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span>!`);
    }

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span>'s Drowning Jutsu is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    // Add or refresh Wet status for 3 turns
    let existingWet = target.statusEffects.findIndex(e => e.name === "Wet");
    if (existingWet !== -1) {
        target.statusEffects[existingWet].duration += 3;
    } else {
        target.statusEffects.push(StatusEffect.Wet(3));
    }

    logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> is now <span class="output-text-water">Wet</span> for 3 more turns!`);
    updateBattleUI();
    await sleep(2000);
    return false;
}


    async kunai(user, target) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> throws a kunai at <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> !`);
        updateBattleUI();
        await sleep(1200);

        let damage = Math.floor(Math.random() * 2) + 1;  // 1-2 damage

        if (await TriggeredCheck(user, target, this, damage)) {
            logBattle(`kunai breaks !`);
            updateBattleUI();
            await sleep(1500);
        } else {
            target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
            target.statusEffects.push(StatusEffect.Bleed(2, 1));
            logBattle(`<strong>kunai</strong> strikes for <strong>${damage} damage</strong> <br> target gains <strong><span class="status-bleed">bleed 🩸</span> !</strong>`);
            updateBattleUI();
            if (DeathCheck()) return true;
            await sleep(1500);
        }

        // Add Substitution to user for 2 turns
        user.statusEffects.push(StatusEffect.Substitute(1, 0));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> gains <strong><span class="status-substitute">substitution</span></strong> !`);
        updateBattleUI();
        await sleep(1500);

        return true;
    }

    async earthTank(user, target) {
        if (user.statusEffects.some(e => e.name === "Dome")) {
            logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> earth tank jutsu<br> <span class="output-text-earth">advance tacics</span></strong> !`);
            const skills = new Skills();
            await skills.barrage(user, target);
            return true;
        }
        user.statusEffects.push(StatusEffect.sling(3, 0));
        user.statusEffects.push(StatusEffect.Dome(3, 0));
logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> operates the <strong>earth dome</strong> !`);
        updateBattleUI();
        user.statusEffects.push(StatusEffect.Numb(1, 0));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> is <strong><span class="output-text-neutral">numb</span> <span class="status-numb">⚡️</span></strong> !`);
        await sleep(2000);
        logBattle(`<strong><span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span></strong> raises <strong><span class="output-text-earth">sling and dome</span></strong> <span class="status-dome">🪨</span> for 3 and 4 turns!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return true;
    }
    
    async earthDomeJutsu(user, target) {
        if (user.statusEffects.some(e => e.name === "Dome")) {
            logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> cannot stack <span class="output-text-earth">earth dome jutsu</span>!`);
            const skills = new Skills();
            await skills.barrage(user, target);
            return true;
        }
        user.statusEffects.push(StatusEffect.Dome(2, 0));
        logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> raises <span class="output-text-earth">Earth Dome Jutsu</span> <span class="status-dome">🪨</span> for 2 turns!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return true;
    }

    async flameThrowJutsu(user, target) {
    let damage = Math.floor(Math.random() * 2) + 2;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> gains 🔥 !`);
       
        const skills = new Skills();
        await skills.fireballJutsu(user, target); user.statusEffects.push(StatusEffect.Burn(1, 2));
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    target.statusEffects.push(StatusEffect.Burn(1, 1));
    user.statusEffects.push(StatusEffect.Burn(1, 2));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> uses <strong><span class="output-text-fire">flame throw jutsu</span></strong> on <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span></strong> for <strong>${damage} damage</strong> <br>target gain <strong><span class="status-burn">burn 🔥 !</span></strong><br>user gains <strong><span class="status-burn">burn 🔥 !</span></strong>`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    const skills = new Skills();
    await skills.fireballJutsu(user, target);
    return false;
}

    async staticFieldJutsu(user, target) {
    let damage = Math.floor(Math.random() * 2) + 1;

    if (await TriggeredCheck(user, target, this, damage)) {
        //logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Static Field is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    user.statusEffects.push(StatusEffect.Recovered(2, 0));
    target.statusEffects.push(StatusEffect.Numb(1, 0));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> uses <strong><span class="output-text-lightning">static field jutsu</span></strong> on <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span></strong> for <strong>${damage} damage</strong><br>target gains <strong><span class="status-numb">numb ⚡️</span></strong> !`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}

    async fireballJutsu(user, target) {
    let damage = Math.floor(Math.random() * 2) + 2;

    if (await TriggeredCheck(user, target, this, damage)) {
        //logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s fireball is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    target.statusEffects.push(StatusEffect.Burn(1, 1));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span></strong> casts <strong><span class="output-text-fire">fireball jutsu</span></strong> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> for <strong>${damage} damage</strong><br>target gains <strong><span class="status-burn">burn 🔥</span></strong> !`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}

async dynamicEntry(user, target) {
    // Remove Swap and Dome statuses (as before)
    target.statusEffects = target.statusEffects.filter(e => e.name !== "Swap" && e.name !== "Dome");
    updateBattleUI();
    await sleep(2000);

    let damage = 1;
    //let wasBlocked = false;

    // Standard defense check (Substitute, Shadow Clone, etc.)
    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span>'s <span class="output-text-neutral">Dynamic Entry</span> is blocked!</strong>`);
        updateBattleUI();
        await sleep(2000);
        //wasBlocked = true;
    } else {
        // Apply damage if not blocked
        target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> deals  <strong>${damage} damage</strong> to <strong><span class="output-text- ${target === player ? 'player' : 'enemy'}">${target.name}</span></strong> with <strong><span class="output-text-neutral">dynamic entry</span>!</strong>`);
        updateBattleUI();

        if (DeathCheck()) return true;
        await sleep(2000);
    }

    // Always try to chain into another random usable jutsu — even if blocked
    let usableSkills = user.activeJutsu.filter(skill => 
        !skill.support && skill.name !== "Dynamic Entry"
    );

    let nextSkill = usableSkills.length > 0 
        ? usableSkills[Math.floor(Math.random() * usableSkills.length)] 
        : null;

    if (nextSkill) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> chains with <strong><span class="output-text-neutral">${nextSkill.name}</span></strong> !`);
        updateBattleUI();
        await nextSkill.skillFunction(user, target);
        if (DeathCheck()) return true;
        await sleep(2000);
    } else {
        // Optional: log if no chain possible
        // logBattle(`<strong>No follow-up jutsu available!</strong>`);
    }

    return false;
      }
  

    async falconDrop(user, target) {
    let damage = 2;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Falcon Drop is blocked!`);
        updateBattleUI();
        await sleep(2000);
    } else {
        target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        user.hp = Math.max(0, Math.min(user.maxHp, user.hp - damage)); // self-damage always happens
        target.statusEffects.push(StatusEffect.Numb(1, 0));
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> uses <span class="output-text-taijutsu">Falcon Drop</span> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> for ${damage} damage, stunning target and taking ${damage} damage!`);
        updateBattleUI();
    }

    if (!user.statusEffects.some(e => e.name === "READY")) {
        user.statusEffects.push(StatusEffect.Ready(2, 0));
    }
    logBattle(`<span class="status-ready">READY 💪</span> applied!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}




    async smokebomb(user, target) {
    const damage = 0;

    if (await TriggeredCheck(user, target, this, damage)) {
        // Blocked: No burn applied, but still chain (tactical pressure)
       // logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong>'s defense blocks the <strong><span class="output-text-fire">smoke bomb</span></strong> !`);
        updateBattleUI();
        await sleep(2000);
        user.statusEffects.push(StatusEffect.Substitute(1, 0));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> gains <strong><span class="status-substitute">substitution</span></strong> !`);
    } else {
        // Passes: Apply burn
        user.statusEffects.push(StatusEffect.Substitute(1, 0));
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> gains <strong><span class="status-substitute">substitution</span></strong> !`);
        updateBattleUI();
        await sleep(2000);
    }

    // Chain to random usable non-support skill (regardless of block - keeps pressure)
    let usableSkills = user.activeJutsu.filter(skill => 
        !skill.support && skill.name !== "smokebomb"  // Exclude self to avoid loops
    );

    let nextSkill = usableSkills.length > 0 
        ? usableSkills[Math.floor(Math.random() * usableSkills.length)] 
        : null;

    if (nextSkill) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> chains with <strong><span class="output-text-neutral">${nextSkill.name}</span></strong> !`);
        updateBattleUI();
        await nextSkill.skillFunction(user, target);
        if (DeathCheck()) return true;
        await sleep(2000);
    }

    return false;
}
   // async 


    async firetag(user, target) {
    const damage = 0;

    if (await TriggeredCheck(user, target, this, damage)) {
        // Blocked: No burn applied, but still chain (tactical pressure)
        logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong>'s defense blocks the <strong><span class="output-text-fire">fire tag</span></strong> !`);
        updateBattleUI();
        await sleep(2000);
    } else {
        // Passes: Apply burn
        target.statusEffects.push(StatusEffect.Burn(1, 1));
        logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> gains <strong><span class="output-text-fire">burn 🔥</span></strong> !`);
        updateBattleUI();
        await sleep(2000);
    }

    // Chain to random usable non-support skill (regardless of block - keeps pressure)
    let usableSkills = user.activeJutsu.filter(skill => 
        !skill.support && skill.name !== "firetag"  // Exclude self to avoid loops
    );

    let nextSkill = usableSkills.length > 0 
        ? usableSkills[Math.floor(Math.random() * usableSkills.length)] 
        : null;

    if (nextSkill) {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> chains with <strong><span class="output-text-neutral">${nextSkill.name}</span></strong> !`);
        updateBattleUI();
        await nextSkill.skillFunction(user, target);
        if (DeathCheck()) return true;
        await sleep(2000);
    }

    return false;
}
   // async 


    async rockSmashJutsu(user, target) {
    let damage = 5;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Rock Smash is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> uses <span class="output-text-earth">Rock Smash Jutsu</span> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> for ${damage} damage!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}

    async genjutsuRelease(user, target) {
        user.statusEffects = user.statusEffects.filter(e => e.name !== "Doom");
        user.statusEffects.push(StatusEffect.Release(1, 0));
        user.statusEffects.push(StatusEffect.Recovered(2, 0));
        user.statusEffects.push(StatusEffect.Regen(1, 2));
        logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> uses <span class="output-text-genjutsu">Genjutsu Release</span>, dispelling Doom and gaining <span class="status-release">Release 🌀</span>!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return true;
    }


    async chainLightning(user, target) {
    let extraInstances = 0;
    let existingChain = user.statusEffects.find(e => e.name === "Charged");
    
    if (existingChain) {
        existingChain.duration += 2;
        existingChain.damage = (existingChain.damage || 1) + 1;
        extraInstances = existingChain.damage - 1;
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> is charging <strong><span class="output-text-lightning">Chain Lightning</span></strong> !`);
        await sleep(2000);
    } else {
        logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> unleashes <strong><span class="output-text-lightning">Chain Lightning</span></strong> !`);
    }

    const totalHits = 4 + extraInstances;

    for (let i = 0; i < totalHits; i++) {
        let damage = 1;

        if (await TriggeredCheck(user, target, this, damage)) {
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span>'s</strong> Chain Lightning strike ${i+1} is blocked!`);
            await sleep(1000);
        } else {
            target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
            logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> strikes <strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> with Chain Lightning for ${damage} damage ! ( ${i+1}/${totalHits})`);
            updateBattleUI();
            if (DeathCheck()) return true;
            await sleep(1000);  // small delay between hits for dramatic feel
        }
    }

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(800);

    // Apply / refresh Chain Lightning status (duration 2, stores the current extra damage level)
    if (!existingChain) {
        user.statusEffects.push(StatusEffect.Charged(2, 1));  // damage here means extra instances
    }

    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> is charged for 2 more turns !`);
    updateBattleUI();
    await sleep(2000);
    return false;
}



    async heavyStormJutsu(user, target) {
    //logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> uses <strong><span class="output-text-water">Heavy Storm Jutsu</span></strong> !`);

    // Deal 2-3 damage (lightning jolt)
    let damage = Math.floor(Math.random() * 2) + 2;
    // Add / refresh Wet on target (heavy rainfall)
    let targetWetIndex = target.statusEffects.findIndex(e => e.name === "Wet");
    if (targetWetIndex !== -1) {
        target.statusEffects[targetWetIndex].duration += 3;
        logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span>'s<strong> <span class="output-text-water">Wet</span> duration increased by 3! 💧`);
    } else {
        target.statusEffects.push(StatusEffect.Wet(3));
        logBattle(`<strong><span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span></strong> becomes <span class="output-text-water">Wet</span> for 3 turns due to heavy rainfall! 💧`);
    }

    // Add / refresh Wet on user
    let userWetIndex = user.statusEffects.findIndex(e => e.name === "Wet");
    if (userWetIndex !== -1) {
        user.statusEffects[userWetIndex].duration += 3;
    } else {
        user.statusEffects.push(StatusEffect.Wet(3));
    }

    // User gains Recovered for 2 turns
    user.statusEffects.push(StatusEffect.Recovered(1, 0));

    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> gains <strong><span class="status-recovered">recovered</span></strong> !`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(1000);
      
    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span>'s jolt of lightning is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span></strong> strikes <span class="output-text-\( {target === player ? 'player' : 'enemy'}"> ${target.name}</span> with a jolt of lightning for <strong>${damage} damage</strong>!`);

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
    }

  

    async lightningEdge(user, target) {
    target.statusEffects = target.statusEffects.filter(e => e.name !== "Substitute" && e.name !== "Dome");
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> launches a Lightning Spirit at <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> </span>!`);
    updateBattleUI();
    await sleep(2000);

    for (let status of target.statusEffects) {
        if (status.triggered && status.triggeredFunction) {
            await status.triggeredFunction(target, user, "lightning");
            if (DeathCheck()) return true;
        }
    }

    let damage = Math.floor(Math.random() * 4) + 3;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span>'s Lightning Edge strike is blocked!`);
        updateBattleUI();
        user.statusEffects.push(StatusEffect.Numb(1, 0));
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> is <span class="output-text-neutral">Numb</span> <span class="status-numb">⚡️</span>!`);
        await sleep(2000);
    } else {
        target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> strikes <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> with <span class="output-text-neutral">Lightning Edge</span> for ${damage} damage!`);
        updateBattleUI();
    }

    if (DeathCheck()) return true;
    await sleep(2000);

    user.statusEffects.push(StatusEffect.Numb(1, 0));
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> is afflicted with <span class="output-text-neutral">Numb</span> <span class="status-numb">⚡️</span>!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return true;
}

    async bite(user, target) {
    let damage = 1;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Bite is blocked!`);
        updateBattleUI();
        await sleep(2000);
        return false;
    }

    target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
    target.statusEffects.push(StatusEffect.Bleed(2, 1));
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> uses <span class="output-text-beast">Bite</span> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> for ${damage} damage, inflicting <span class="status-bleed">Bleed 🩸</span>!`);
    updateBattleUI();

    let heal = user.hp < user.maxHp ? 1 : 0;
    user.hp = Math.min(user.maxHp, user.hp + heal);
    if (heal > 0) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> heals ${heal} HP from <span class="output-text-beast">Bite</span>!`);
        updateBattleUI();
    }

    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
}

    async nightTerrorJutsu(user, target) {
        target.statusEffects.push(StatusEffect.Numb(1, 0));
        target.statusEffects.push(StatusEffect.Doom(5, 1));
        logBattle(`<span class="output-text-${user === player ? 'player' : 'enemy'}">${user.name}</span> casts <span class="output-text-genjutsu">Night Terror Jutsu</span> on <span class="output-text-${target === player ? 'player' : 'enemy'}">${target.name}</span>, inflicting <span class="status-numb">Numb ⚡️</span> and <span class="status-doom">Doom 💀</span>!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);
        return false;
    }

    async wildFireJutsu(user, target) {
    // Only applies the Wild Fire status to the caster (user)
    user.statusEffects.push(StatusEffect.wildfire(3));
        target.statusEffects.push(StatusEffect.Burn(1, 1));
    logBattle(`<strong><span class="output-text-\( {user === player ? 'player' : 'enemy'}"> ${user.name}</span> ignites <span class="output-text-neutral">wild fire</span><span class="status-burn">🔥</span>!</strong>`);
    updateBattleUI();

    if (DeathCheck()) return true;
    await sleep(2000);

    return false;
}

    async hellFireJutsu(user, target) {
    target.statusEffects.push(StatusEffect.Doom(5, 1));
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> afflicts <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span> with <span class="output-text-neutral">Doom</span> <span class="status-doom">💀</span> for 5 turns!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    let damage = 2;

    if (await TriggeredCheck(user, target, this, damage)) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Hell Fire Burn is blocked!`);
        updateBattleUI();
        await sleep(2000);
    } else {
        target.statusEffects.push(StatusEffect.Burn(1, 2));
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> casts <span class="output-text-neutral">Hell Fire Jutsu</span> on <span class="output-text-\( {target === player ? 'player' : 'enemy'}">${target.name}</span>, inflicting <span class="status-burn">Burn 🔥</span>!`);
        updateBattleUI();
    }

    if (DeathCheck()) return true;
    await sleep(2000);
    return true;
}

    async bloodstreamBarrage(user, target) {
        let baseDamage = Math.floor(Math.random() * 2) + 1;
        let comboDamage = Math.floor(Math.random() * 2) + 1;
        let totalDamage = baseDamage + comboDamage;

        // Check defenses first (like normal Barrage)
        if (await TriggeredCheck(user, target, this, totalDamage)) {
            logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span>'s Bloodstream Barrage is blocked!`);
            updateBattleUI();
            await sleep(2000);
            return false;
        }

        // First hit + Bleed
        target.hp = Math.max(0, Math.min(target.maxHp, target.hp - baseDamage));
        target.statusEffects.push(StatusEffect.Bleed(2, 1)); // Bleed for 2 turns, 1 dmg/tick
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> strikes ${target.name} for ${baseDamage} damage. Target gains<span class="status-bleed">Bleed 🩸</span>!`);
        updateBattleUI();
        if (DeathCheck()) return true;
        await sleep(2000);

        // Combo hit + second Bleed (stacks duration if already bleeding)
        if (target.hp > 0) {
            target.hp = Math.max(0, Math.min(target.maxHp, target.hp - comboDamage));
            target.statusEffects.push(StatusEffect.Bleed(2, 1)); // Second application
            logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}">${user.name}</span> combos ${target.name} for ${comboDamage} damage. Target gains <span class="status-bleed">Bleed 🩸</span>!`);
            updateBattleUI();
            if (DeathCheck()) return true;
            await sleep(2000);
        }

        return false;
    }
    async summonDog(user, target) {
    if (user.hp < 4) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span> does not have enough HP (needs 4) to summon a dog!`);
        updateBattleUI();
        await sleep(2000);
        const skills = new Skills();
        await skills.bite(user, target);
        return false;
    }

    let dogCount = user.statusEffects.filter(e => e.name === "Dog").length;
    if (dogCount >= 2) {
        logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span> already has the maximum of 2 dogs!`);
        updateBattleUI();
        await sleep(2000);
        const skills = new Skills();
        await skills.bite(user, target);
        return false;
    }

    // Summon message
    logBattle(`<span class="output-text-\( {user === player ? 'player' : 'enemy'}"> \){user.name}</span> summons a dog companion <span class="status-dog">🐺</span>!`);
    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);

    // Apply the Dog status with bite function
    const skills = new Skills();
    user.statusEffects.push(StatusEffect.Dog(6, 0, skills.bite.bind(skills)));

    updateBattleUI();
    if (DeathCheck()) return true;
    await sleep(2000);
    return false;
    }
      }
