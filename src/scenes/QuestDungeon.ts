import Phaser from 'phaser'
import { createCharacterAnims } from '../anims/CharacterAnims'
import { createLizardAnims } from '../anims/EnemyAnims'
import { quest, approachGate, openChest, nextRoom, recordCombatWin } from '../main'

import { creatureFor, type Creature } from '../creatures'

type Enemy = { sprite: Phaser.GameObjects.Sprite; hp: number; max: number; floor: number; boss: boolean; guardian: boolean; staggered: boolean; nextShot: number; hitUntil: number; shield: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; creature: Creature | null }
type Bolt = { sprite: Phaser.GameObjects.Arc; vx: number; vy: number; until: number; floor: number }

export default class QuestDungeon extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private enemies: Enemy[] = []
  private bolts: Bolt[] = []
  private bars!: Phaser.GameObjects.Graphics
  private gate!: Phaser.GameObjects.Container
  private gateLabel!: Phaser.GameObjects.Text
  private queen!: Phaser.GameObjects.Container
  private statusText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private bossTitle!: Phaser.GameObjects.Text
  private floor = 0
  private hp = 6
  private lastDamage = 0
  private nextSwing = 0
  private touchDirection = ''
  private attackHeld = false
  private climbing = false
  private downed = false
  private introUntil = 0
  private facing = new Phaser.Math.Vector2(1, 0)
  private roomKey = ''
  private encounter = 0
  private lastStatus = ''
  private shieldPrompt = 0
  private chests: Phaser.GameObjects.Sprite[] = []
  private obstacles: {rect:Phaser.Geom.Rectangle;floor:number;solid:boolean}[] = []
  private jumping = false
  private jumpOffset = 0
  private nextJump = 0
  private heroShadow!: Phaser.GameObjects.Ellipse
  private obstaclePrompt = 0
  private finisherEnemy: Enemy | null = null
  private finisherArmed = false
  private finishing = false
  constructor() { super('quest-dungeon') }
  preload() {
    this.load.spritesheet('dungeon-tiles', 'tiles/dungeon_tiles.png', { frameWidth: 16, frameHeight: 16 })
    this.load.atlas('faune', 'character/fauna.png', 'character/fauna.json')
    this.load.atlas('lizard', 'enemies/lizard.png', 'enemies/lizard.json')
    this.load.atlas('treasure', 'items/treasure.png', 'items/treasure.json')
    this.load.on('loaderror', () => { document.getElementById('feedback')!.textContent = 'A game asset could not load. Refresh while the local server is running.' })
  }
  create() {
    if (!this.anims.exists('faune-idle-up')) createCharacterAnims(this.anims)
    if (!this.anims.exists('lizard-run')) createLizardAnims(this.anims)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,J,E,SHIFT,K,Q,F') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.removeCapture([37, 38, 39, 40, 32, 87, 65, 83, 68, 74, 69, 16, 75, 81, 70])
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.isEditing() && (event.key.startsWith('Arrow') || event.code === 'Space' || event.key === 'Shift')) event.preventDefault()
    })
    const shortcuts: [string,()=>void][]=[['F',()=>this.requestFinisher()],['Q',()=>approachGate()],['E',()=>this.interact()],['K',()=>this.jump()],['SHIFT',()=>this.jump()]]
    shortcuts.forEach(([key,action])=>this.input.keyboard!.on(`keydown-${key}`,()=>{if(!this.isEditing())action()}))
    this.input.on('pointerdown', () => { if (!document.querySelector('dialog[open]')) (document.activeElement as HTMLElement)?.blur() })
    const changed = () => this.refreshRoom()
    const touch = (direction: string) => { this.touchDirection = direction }
    const attack = (held: boolean) => { this.attackHeld = held; if (held && !this.isEditing()) this.swing() }
    const climb = () => this.climbLadder()
    const interact = () => this.interact()
    const retry = () => this.refreshRoom()
    const correct = () => this.answerMagic()
    const jump = () => this.jump()
    const reset = () => { this.touchDirection='';this.attackHeld=false;this.input.keyboard?.resetKeys() }
    const chest = (index:number) => this.rewardChest(index)
    const finish = () => this.requestFinisher()
    const wrong = () => { this.cameras.main.shake(160, .004); this.floatText(320, 220, 'THE SEAL HOLDS', '#f7a18b') }
    const bindings: [string, (...args: any[]) => void][] = [['quest-changed', changed], ['move-touch', touch], ['attack-held', attack], ['climb-ladder', climb], ['retry-battle', retry], ['answer-correct', correct], ['answer-wrong', wrong], ['jump-request',jump], ['reset-controls',reset], ['interact-request',interact], ['chest-unlocked',chest], ['finisher-request',finish]]
    bindings.forEach(([event, fn]) => this.game.events.on(event, fn))
    this.events.once('shutdown', () => bindings.forEach(([event, fn]) => this.game.events.off(event, fn)))
    this.refreshRoom();this.game.events.emit('game-ready')
  }
  private isEditing() { return !!document.querySelector('dialog[open]') || ['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName || '') }
  private isBossRoom() { return quest.current === quest.levels.length - 1 }
  private refreshRoom() {
    this.encounter++; this.tweens.killAll(); this.time.removeAllEvents(); this.children.removeAll(true)
    this.enemies = []; this.bolts = []; this.chests=[]; this.obstacles=[]; this.jumping=false; this.jumpOffset=0; this.nextJump=0; this.floor = 0; this.hp = 6; this.downed = false; this.climbing = false
    this.touchDirection = ''; this.attackHeld = false; this.nextSwing = 0; this.lastDamage = -2000; this.shieldPrompt = 0; this.lastStatus = ''
    this.finisherEnemy=null;this.finisherArmed=false;this.finishing=false
    document.getElementById('finisher-prompt')!.hidden=true
    this.roomKey = `${quest.id}:${quest.current}`
    this.cameras.main.resetFX(); this.cameras.main.setBackgroundColor(this.isBossRoom() ? '#201522' : '#111b20')
    this.drawFloor(80, 208); this.drawFloor(272, 400)
    this.add.text(42, 61, this.isBossRoom() ? 'THE WARDEN’S KEEP' : 'UPPER KEEP', { fontFamily: 'monospace', fontSize: '9px', color: '#9cb0b2' })
    this.add.text(42, 252, 'LOWER HALL', { fontFamily: 'monospace', fontSize: '9px', color: '#9cb0b2' })
    this.drawLadder()
    this.drawObstacles()
    for (const x of [80, 480]) for (const y of [101, 293]) {
      this.add.rectangle(x, y + 4, 8, 12, 0x5d4941)
      const glow = this.add.circle(x, y, 23, 0xffc26e, .1)
      const flame = this.add.ellipse(x, y - 4, 7, 12, 0xf8c16f)
      this.tweens.add({ targets: [glow, flame], alpha: .5, scaleX: .8, duration: 450 + x, yoyo: true, repeat: -1 })
    }
    if(!this.anims.exists('treasure-unlock'))this.anims.create({key:'treasure-unlock',frames:this.anims.generateFrameNames('treasure',{start:0,end:2,prefix:'chest_empty_open_anim_f',suffix:'.png'}),frameRate:7})
    ;[[78,371],[460,122]].forEach(([x,y],index)=>{
      const opened=quest.levels[quest.current].chests[index]
      const chest=this.add.sprite(x,y,'treasure',opened?'chest_empty_open_anim_f2.png':'chest_empty_open_anim_f0.png').setScale(1.5).setDepth(6).setInteractive({useHandCursor:true})
      chest.on('pointerdown',()=>{if(this.floor!==index){this.message('Climb to this floor to reach its chest.');return}if(!this.climbing&&!this.downed)openChest(index)})
      this.chests.push(chest)
      this.add.text(x,y-23,opened?'LOOTED':'BONUS CHEST',{fontFamily:'monospace',fontSize:'6px',color:opened?'#87998d':'#efd28c'}).setOrigin(.5)
    })
    const gateArt = this.add.graphics(); gateArt.fillStyle(0x081016); gateArt.fillRoundedRect(-19, -26, 38, 51, {tl:18,tr:18,bl:0,br:0}); gateArt.lineStyle(2, 0xe4c480); gateArt.strokeRoundedRect(-19, -26, 38, 51, {tl:18,tr:18,bl:0,br:0})
    for (let x = -12; x <= 12; x += 8) { gateArt.lineStyle(2, 0x9e8253); gateArt.lineBetween(x, -16, x, 24) }
    this.gate = this.add.container(595, 139, [gateArt]).setSize(50, 60).setInteractive().on('pointerdown', () => nextRoom())
    this.gateLabel = this.add.text(595, 176, '', {fontFamily:'monospace',fontSize:'7px',color:'#e8cc8a',align:'center'}).setOrigin(.5)
    this.heroShadow=this.add.ellipse(126,352,22,7,0x050a0d,.65).setDepth(5)
    this.hero = this.add.sprite(126, 342, 'faune').setScale(1.5).setDepth(10).play('faune-idle-side')
    this.bars = this.add.graphics().setDepth(25)
    this.hpText = this.add.text(28, 19, '', {fontFamily:'monospace',fontSize:'12px',color:'#f0bcaa'}).setDepth(30)
    this.bossTitle = this.add.text(335, 21, '', {fontFamily:'monospace',fontSize:'10px',color:'#f1c789'}).setOrigin(.5).setDepth(30)
    this.add.text(610, 21, `FLOOR ${quest.current + 1}/${quest.levels.length}`, {fontFamily:'monospace',fontSize:'9px',color:'#a0b0ac'}).setOrigin(1,0)
    this.statusText = this.add.text(320, 427, '', {fontFamily:'monospace',fontSize:'9px',color:'#d4c28b',align:'center'}).setOrigin(.5).setDepth(30)
    const crown = this.add.graphics(); crown.fillStyle(0xebc77a); crown.fillPoints([{x:-8,y:-16},{x:-8,y:-24},{x:-3,y:-20},{x:0,y:-27},{x:3,y:-20},{x:8,y:-24},{x:8,y:-16}], true)
    const queenBody = this.add.graphics(); queenBody.fillStyle(0xc3a1d5); queenBody.fillTriangle(0,-6,-12,16,12,16); queenBody.fillStyle(0xf0d2b3); queenBody.fillCircle(0,-11,6)
    this.queen = this.add.container(405, 157, [queenBody,crown]).setVisible(quest.levels.every(l => l.completed && l.combatWon))
    if (!quest.levels[quest.current].combatWon) {
      this.spawnEnemy(265, 344, 0, false)
      this.spawnEnemy(this.isBossRoom() ? 295 : 355, 155, 1, this.isBossRoom())
    }
    this.introUntil = this.time.now + (this.isBossRoom() && !quest.levels[quest.current].combatWon ? 1700 : 400)
    if (this.isBossRoom() && !quest.levels[quest.current].combatWon) {
      const banner = this.add.container(320, 225).setDepth(40)
      const bg = this.add.rectangle(0, 0, 550, 68, 0x160c20, .94).setStrokeStyle(1, 0xa574b3)
      const title = this.add.text(0, -9, 'THE SERIES WARDEN', {fontFamily:'Georgia',fontSize:'24px',color:'#ebcf92'}).setOrigin(.5)
      const sub = this.add.text(0, 18, 'Two hits. One question. One final strike.', {fontFamily:'monospace',fontSize:'9px',color:'#d1b6d9'}).setOrigin(.5)
      banner.add([bg,title,sub]); this.tweens.add({targets:banner,alpha:0,y:210,delay:1400,duration:400,onComplete:()=>banner.destroy()})
    }
    this.refreshGate(); this.updateHud()
  }
  private drawFloor(top: number, bottom: number) {
    this.add.rectangle(320, (top + bottom) / 2 + 8, 590, bottom - top + 22, 0x070c10, .8)
    for (let y = top; y <= bottom; y += 16) for (let x = 40; x <= 600; x += 16) {
      const edge = y === top || y === bottom || x === 40 || x === 600
      this.add.image(x, y, 'dungeon-tiles', edge ? (y === top || y === bottom ? 12 : x === 40 ? 11 : 13) : ((x + y) % 112 === 0 ? 18 : 38))
    }
    this.add.rectangle(320, bottom - 2, 540, 2, 0x6e6660, .4)
  }
  private drawLadder() {
    const ladder = this.add.graphics().setDepth(3)
    ladder.lineStyle(5, 0x5d3d28); ladder.lineBetween(533, 190, 533, 300); ladder.lineBetween(555, 190, 555, 300)
    ladder.lineStyle(3, 0xc5a26c)
    for (let y = 195; y < 300; y += 11) ladder.lineBetween(533, y, 555, y)
    const glow = this.add.rectangle(544, 245, 35, 110, 0xebc77a, .04)
    this.tweens.add({targets:glow,alpha:.2,duration:900,yoyo:true,repeat:-1})
    this.add.zone(544, 245, 42, 130).setInteractive().on('pointerdown', () => this.climbLadder())
    this.add.text(544, 235, 'E', {fontFamily:'monospace',fontSize:'9px',color:'#f5dc9f',backgroundColor:'#1c211d',padding:{x:4,y:3}}).setOrigin(.5)
  }
  private spawnEnemy(x: number, y: number, floor: number, boss: boolean) {
    if (boss && !this.textures.exists('warden')) {
      const g = this.make.graphics({x:0,y:0})
      g.fillStyle(0x382d4e); g.fillTriangle(12,24,0,50,20,44); g.fillTriangle(52,24,64,50,44,44)
      g.fillStyle(0x74508d); g.fillRect(16,20,32,35); g.fillRect(10,28,10,18); g.fillRect(44,28,10,18)
      g.fillStyle(0x392841); g.fillRect(19,48,9,12); g.fillRect(37,48,9,12)
      g.fillStyle(0xc19a73); g.fillRect(20,6,6,18); g.fillRect(39,6,6,18)
      g.fillStyle(0x9977b3); g.fillRect(20,17,25,19)
      g.fillStyle(0xffdf8d); g.fillRect(23,24,6,4); g.fillRect(36,24,6,4)
      g.fillStyle(0x211a30); g.fillRect(28,33,10,4)
      g.fillStyle(0xe8c673); g.fillRect(21,41,23,4); g.fillRect(28,38,8,10)
      g.generateTexture('warden',64,64); g.destroy()
    }
    const creature=boss?null:creatureFor(this,quest.current)
    const sprite = this.add.sprite(x,y,boss ? 'warden':creature!.texture).setScale(boss?1.25:creature!.kind==='lizard'?1.7:1.05).setDepth(9)
    if (!boss) sprite.play(creature!.animation)
    const shield = this.add.circle(x,y,boss?46:25,0xab76dd,.08).setStrokeStyle(2,0xbd8fe2,.8).setDepth(8).setVisible(boss && !quest.levels[quest.current].completed)
    const label = this.add.text(x,y-(boss?54:30),boss?'SERIES WARDEN':creature!.name,{fontFamily:'monospace',fontSize:boss?'9px':'7px',color:boss?'#e6c6ef':'#bacb9d'}).setOrigin(.5).setDepth(20)
    const guardian=floor===1, health=guardian?3:2
    this.enemies.push({sprite,hp:health,max:health,floor,boss,guardian,staggered:false,nextShot:this.time.now+2700,hitUntil:0,shield,label,creature})
    if (boss) this.tweens.add({targets:sprite,scaleY:1.3,duration:850,yoyo:true,repeat:-1})
  }
  private drawObstacles(){
    const crate=new Phaser.Geom.Rectangle(337,315,36,51)
    const art=this.add.graphics().setDepth(5);art.fillStyle(0x684a35);art.fillRect(crate.x,crate.y,crate.width,crate.height);art.lineStyle(2,0xbfa072);art.strokeRect(crate.x+2,crate.y+2,crate.width-4,crate.height-4);art.lineBetween(crate.x+3,crate.y+3,crate.right-3,crate.bottom-3);art.lineBetween(crate.right-3,crate.y+3,crate.x+3,crate.bottom-3)
    this.obstacles.push({rect:crate,floor:0,solid:true})
    const spikes=new Phaser.Geom.Rectangle(428,145,35,43)
    art.fillStyle(0x3b3943);art.fillRect(spikes.x-3,spikes.y-2,41,47)
    for(let x=spikes.x;x<spikes.right;x+=9)for(let y=spikes.y+5;y<spikes.bottom;y+=12){art.fillStyle(0xb5bbc0);art.fillTriangle(x,y+7,x+4,y-3,x+8,y+7)}
    this.obstacles.push({rect:spikes,floor:1,solid:false})
    this.add.text(355,382,'SHIFT / K TO JUMP',{fontFamily:'monospace',fontSize:'6px',color:'#c1ac7d'}).setOrigin(.5)
  }
  private jump(){
    if(!this.hero||this.jumping||this.climbing||this.downed||this.isEditing()||this.time.now<this.nextJump||this.time.now<this.introUntil)return
    this.jumping=true;this.nextJump=this.time.now+750
    this.burst(this.hero.x,this.hero.y+12,0x9aab9d,5)
    this.tweens.add({targets:this,jumpOffset:34,duration:280,yoyo:true,ease:'Sine.out',onComplete:()=>{this.jumping=false;this.jumpOffset=0;this.hero?.setOrigin(.5)}})
    this.updateHud()
  }
  private interact(){
    if(!this.hero||this.climbing||this.jumping||this.downed||this.isEditing())return
    const chest=this.chests[this.floor]
    if(chest&&Phaser.Math.Distance.Between(this.hero.x,this.hero.y,chest.x,chest.y)<75){openChest(this.floor);return}
    if(this.floor===1&&this.hero.x>555){nextRoom();return}
    this.climbLadder()
  }
  private rewardChest(index:number){
    const chest=this.chests[index];if(!chest)return
    chest.play('treasure-unlock');this.hp=Math.min(6,this.hp+2);this.burst(chest.x,chest.y,0xf6d37c,25);this.floatText(chest.x,chest.y-25,'+25 XP · +2 HP','#ffe0a1');this.updateHud()
  }
  private refreshGate() {
    const level = quest.levels[quest.current]
    const open = level.completed && level.combatWon
    this.gate.setAlpha(open ? .35 : 1)
    this.gateLabel.setText(open?'GATE OPEN':!level.completed?'ANSWER\nREQUIRED':'DEFEAT ALL\nMONSTERS')
    this.queen.setVisible(quest.levels.every(l=>l.completed&&l.combatWon))
  }
  private answerMagic() {
    if (!this.hero) return
    if(this.finisherEnemy?.staggered&&this.finisherArmed&&quest.levels[quest.current].completed){this.runFinisher(this.finisherEnemy);return}
    this.enemies.forEach(e=>{if(e.boss){e.shield.setVisible(false);this.burst(e.sprite.x,e.sprite.y,0xd8b3ff,28);this.floatText(e.sprite.x,e.sprite.y-60,'SHIELD BROKEN!','#f4d587')}})
    this.burst(this.hero.x,this.hero.y,0xf4d587,16)
    this.cameras.main.flash(200,180,130,240,false)
    this.refreshGate(); this.checkClear(); this.updateHud()
  }
  private swing() {
    if (!this.hero || this.downed || this.climbing || this.finishing || this.time.now < this.nextSwing || this.time.now < this.introUntil || this.isEditing()) return
    this.nextSwing = this.time.now + 340
    const angle = this.facing.angle()
    const slash = this.add.graphics().setDepth(22).setPosition(this.hero.x,this.hero.y)
    slash.lineStyle(9,0xffe6a1,.85); slash.beginPath(); slash.arc(0,0,39,angle-1.05,angle+1.05); slash.strokePath()
    slash.lineStyle(2,0xffffff,.9); slash.beginPath(); slash.arc(0,0,45,angle-1.05,angle+1.05); slash.strokePath()
    const sword = this.add.graphics().setDepth(23).setPosition(this.hero.x,this.hero.y).setRotation(angle)
    sword.fillStyle(0xe1e6da); sword.fillTriangle(14,-3,49,0,14,3); sword.fillStyle(0xd1a555); sword.fillRect(12,-8,4,16); sword.fillStyle(0x795b46); sword.fillRect(4,-2,10,4)
    this.tweens.add({targets:slash,alpha:0,scale:1.3,duration:190,onComplete:()=>slash.destroy()})
    this.tweens.add({targets:sword,rotation:angle+.65,alpha:0,duration:170,onComplete:()=>sword.destroy()})
    const candidates=this.enemies.filter(e=>e.hp>0&&e.floor===this.floor&&Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.sprite.x,e.sprite.y)<(e.boss?77:62)).sort((a,b)=>Phaser.Math.Distance.Between(this.hero.x,this.hero.y,a.sprite.x,a.sprite.y)-Phaser.Math.Distance.Between(this.hero.x,this.hero.y,b.sprite.x,b.sprite.y))
    const enemy=candidates[0]
    if(enemy){
      if(enemy.staggered){
        this.floatText(enemy.sprite.x,enemy.sprite.y-40,'PRESS F · FINAL BLOW','#f7d68e')
      }else{
        enemy.hp--; enemy.hitUntil=this.time.now+180; enemy.sprite.setTintFill(0xffffff)
        const dx=enemy.sprite.x-this.hero.x,dy=enemy.sprite.y-this.hero.y;const v=new Phaser.Math.Vector2(dx,dy).normalize().scale(enemy.boss?5:12)
        enemy.sprite.x=Phaser.Math.Clamp(enemy.sprite.x+v.x,75,570);enemy.sprite.y=Phaser.Math.Clamp(enemy.sprite.y+v.y,this.floor?119:300,this.floor?187:378)
        this.burst(enemy.sprite.x,enemy.sprite.y,enemy.boss?0xc999ea:(enemy.creature?.color||0xb9db87),10);this.floatText(enemy.sprite.x,enemy.sprite.y-25,'−1', '#ffe2a3');this.cameras.main.shake(70,.002)
        if(enemy.guardian&&enemy.hp===1){
          enemy.staggered=true;enemy.shield.setVisible(false);enemy.sprite.setTint(0xe4c381);this.finisherEnemy=enemy
          this.bolts.forEach(b=>b.until=0);this.attackHeld=false
          this.floatText(enemy.sprite.x,enemy.sprite.y-45,'GUARD BROKEN!','#ffdf8e')
          this.message('Guard broken! Press F or Final blow, answer the question, and finish with one strike.')
          this.tweens.add({targets:enemy.sprite,alpha:.5,duration:450,yoyo:true,repeat:-1})
        }else if(enemy.hp<=0)this.defeat(enemy)
      }
    }
    this.bolts.forEach(b=>{if(b.floor===this.floor&&Phaser.Math.Distance.Between(this.hero.x,this.hero.y,b.sprite.x,b.sprite.y)<60){this.burst(b.sprite.x,b.sprite.y,0xeaca8a,5);b.until=0}})
    this.updateHud()
  }
  private requestFinisher(){
    if(!this.finisherEnemy?.staggered||this.finishing||this.downed||this.climbing||this.isEditing()||this.floor!==this.finisherEnemy.floor)return
    this.finisherArmed=true;this.attackHeld=false;this.touchDirection='';approachGate(true)
  }
  private runFinisher(enemy:Enemy){
    if(this.finishing||enemy.hp<=0)return
    this.finishing=true;this.finisherArmed=false;this.attackHeld=false;this.touchDirection='';this.input.keyboard?.resetKeys()
    document.getElementById('finisher-prompt')!.hidden=true
    this.bolts.forEach(b=>b.until=0);this.tweens.killTweensOf(enemy.sprite);enemy.sprite.setAlpha(1)
    const x=enemy.sprite.x,y=enemy.sprite.y
    const shade=this.add.rectangle(320,220,640,440,0x050912,.5).setDepth(29)
    const top=this.add.rectangle(320,0,640,32,0x05070c,.95).setOrigin(.5,0).setDepth(45)
    const bottom=this.add.rectangle(320,440,640,32,0x05070c,.95).setOrigin(.5,1).setDepth(45)
    this.hero.setDepth(40);enemy.sprite.setDepth(39);this.hero.setFlipX(false);this.hero.play('faune-run-side')
    this.tweens.add({targets:this.hero,x:x-24,y,duration:220,ease:'Cubic.in',onComplete:()=>{
      const slash=this.add.graphics().setDepth(44);slash.lineStyle(15,0xf4d487,.95);slash.lineBetween(x-90,y+38,x+90,y-38);slash.lineStyle(5,0xffffff);slash.lineBetween(x-90,y+38,x+90,y-38)
      this.cameras.main.flash(150,245,225,190,false);this.cameras.main.shake(260,.007)
      enemy.hp=0;this.defeat(enemy);this.hero.x=x+38;this.hero.play('faune-idle-side')
      this.floatText(320,225,'FINAL BLOW','#ffe6a3')
      this.tweens.add({targets:slash,alpha:0,scaleX:1.25,duration:480,onComplete:()=>slash.destroy()})
    }})
    this.time.delayedCall(950,()=>{shade.destroy();top.destroy();bottom.destroy();this.hero.setDepth(10);this.finishing=false;this.finisherEnemy=null;this.refreshGate();this.updateHud()})
  }
  private defeat(enemy: Enemy) {
    enemy.shield.setVisible(false);enemy.label.setVisible(false)
    if(enemy.boss){
      this.bolts.forEach(b=>b.until=0);this.cameras.main.shake(450,.008);this.burst(enemy.sprite.x,enemy.sprite.y,0xf4cf7f,40)
      this.floatText(320,220,'THE WARDEN HAS FALLEN','#f7d992')
      this.tweens.add({targets:enemy.sprite,angle:15,alpha:0,scaleX:2,scaleY:2,duration:700,onComplete:()=>enemy.sprite.setVisible(false)})
    }else{
      this.tweens.add({targets:enemy.sprite,alpha:0,angle:90,scale:0.2,y:enemy.sprite.y-12,duration:300,onComplete:()=>enemy.sprite.setVisible(false)})
    }
    this.checkClear()
  }
  private checkClear(){
    if(this.enemies.every(e=>e.hp<=0)&&!quest.levels[quest.current].combatWon){
      recordCombatWin();this.refreshGate();this.message(quest.levels[quest.current].completed?'Room cleared! Take the ladder and enter the open gate.':'Monsters defeated! Solve the assignment question to open the gate.')
    }
  }
  private climbLadder(){
    if(!this.hero||this.climbing||this.jumping||this.downed||this.isEditing())return
    if(this.enemies.some(e=>e.floor===this.floor&&e.hp>0)){this.message('Defeat the monsters on this floor before climbing the ladder.');return}
    this.climbing=true;this.attackHeld=false;this.touchDirection=''
    const room=this.encounter, dest=this.floor===0?1:0, startY=this.floor===0?302:191, endY=dest===1?177:310
    this.hero.play('faune-run-side',true);this.hero.setFlipX(this.hero.x>544)
    this.tweens.add({targets:this.hero,x:544,y:startY,duration:Math.max(200,Math.abs(this.hero.x-544)*2),onComplete:()=>{
      if(room!==this.encounter)return
      this.hero.play(dest===1?'faune-run-up':'faune-run-down',true)
      this.tweens.add({targets:this.hero,y:endY,duration:1050,ease:'Sine.inOut',onComplete:()=>{if(room!==this.encounter)return;this.floor=dest;this.climbing=false;this.hero.play('faune-idle-up');this.floatText(544,endY-30,dest?'UPPER KEEP':'LOWER HALL','#e5cc8c');this.updateHud()}})
    }})
    this.updateHud()
  }
  private damage(){
    if(this.downed||this.climbing||this.jumping||this.finishing||this.finisherEnemy?.staggered||this.time.now<this.lastDamage+1200)return
    this.hp--;this.lastDamage=this.time.now;this.cameras.main.shake(140,.005);this.floatText(this.hero.x,this.hero.y-28,'−1 HP','#ffac9c');this.hero.setTint(0xf5a19c)
    if(this.hp<=0){this.downed=true;this.attackHeld=false;this.hero.play('faune-faint');this.message('You fell in battle. Retry the encounter—your assignment answers are safe.');this.floatText(320,225,'A KNIGHT RISES AGAIN','#efc2ad')}
    this.updateHud()
  }
  private castBolt(enemy:Enemy){
    const x=this.hero.x,y=this.hero.y
    const warning=this.add.circle(x,y,23,0xe575a6,.12).setStrokeStyle(1,0xee9ab4,.8).setDepth(4)
    this.tweens.add({targets:warning,scale:1.25,alpha:.8,duration:550,yoyo:true,repeat:0})
    this.time.delayedCall(650,()=>{
      warning.destroy();if(enemy.hp<=0||this.downed||this.floor!==enemy.floor)return
      const direction=new Phaser.Math.Vector2(x-enemy.sprite.x,y-enemy.sprite.y).normalize().scale(115)
      const sprite=this.add.circle(enemy.sprite.x,enemy.sprite.y,7,0xd891f0,.9).setStrokeStyle(2,0xf4c3ff).setDepth(15)
      this.bolts.push({sprite,vx:direction.x,vy:direction.y,until:this.time.now+4000,floor:enemy.floor})
    })
  }
  private burst(x:number,y:number,color:number,count:number){
    for(let i=0;i<count;i++){const p=this.add.rectangle(x,y,Phaser.Math.Between(2,5),Phaser.Math.Between(2,5),color).setDepth(26);const angle=Math.random()*Math.PI*2,distance=Phaser.Math.Between(12,55);this.tweens.add({targets:p,x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance,alpha:0,angle:120,duration:Phaser.Math.Between(240,650),onComplete:()=>p.destroy()})}
  }
  private floatText(x:number,y:number,text:string,color:string){const label=this.add.text(x,y,text,{fontFamily:'monospace',fontSize:'11px',color,stroke:'#12151c',strokeThickness:3}).setOrigin(.5).setDepth(35);this.tweens.add({targets:label,y:y-30,alpha:0,duration:1000,onComplete:()=>label.destroy()})}
  private message(text:string){document.getElementById('feedback')!.textContent=text}
  private updateHud(){
    const live=this.enemies.filter(e=>e.hp>0),boss=this.enemies.find(e=>e.boss&&e.hp>0)
    this.hpText.setText('♥'.repeat(this.hp)+'♡'.repeat(6-this.hp))
    this.bossTitle.setText(boss?`WARDEN · ${boss.staggered?'FINAL BLOW READY':`${3-boss.hp}/2 HITS`}`:'')
    const text=this.downed?'DEFEATED · RETRY ENCOUNTER':this.climbing?'CLIMBING THE LADDER…':`${live.length} MONSTER${live.length===1?'':'S'} · ${this.floor===0?'LOWER HALL':'UPPER KEEP'} · ${quest.levels[quest.current].completed?'ANSWER CORRECT':'SOLVE THE SEAL'}`
    this.statusText.setText(text)
    const status=document.getElementById('battle-status')!
    if(text!==this.lastStatus){status.textContent=text;this.lastStatus=text}
    status.dataset.monsters=String(live.length);status.dataset.floor=String(this.floor);status.dataset.hp=String(this.hp);status.dataset.climbing=String(this.climbing);status.dataset.bossHp=String(boss?.hp||0);status.dataset.shielded=String(!!boss&&!quest.levels[quest.current].completed);status.dataset.jumping=String(this.jumping);status.dataset.heroX=String(Math.round(this.hero.x));status.dataset.heroY=String(Math.round(this.hero.y));status.dataset.creature=this.enemies.find(e=>!e.boss)?.creature?.kind||'cleared';status.dataset.chests=String(quest.levels[quest.current].chests.filter(Boolean).length)
    status.dataset.finisherReady=String(!!this.finisherEnemy?.staggered&&!this.finishing);status.dataset.finishing=String(this.finishing)
    document.getElementById('finisher-prompt')!.hidden=!this.finisherEnemy?.staggered||this.finishing||this.downed
    const retry=document.getElementById('retry-battle') as HTMLButtonElement;retry.hidden=!this.downed
    const climb=document.getElementById('climb-button') as HTMLButtonElement;climb.disabled=this.climbing||this.downed;climb.textContent=this.climbing?'Climbing…':this.floor===0?'⇧ Ladder / E':'⇩ Ladder / E'
    this.bars.clear()
    live.forEach(e=>{const w=e.boss?72:30,y=e.sprite.y-(e.boss?43:22);this.bars.fillStyle(0x16171d);this.bars.fillRect(e.sprite.x-w/2,y,w,4);this.bars.fillStyle(e.boss?0xc58be5:0xaaca84);this.bars.fillRect(e.sprite.x-w/2,y,w*e.hp/e.max,4)})
  }
  update(time:number,delta:number){
    if(!this.hero)return
    if(this.roomKey!==`${quest.id}:${quest.current}`){this.refreshRoom();return}
    const dt=Math.min(delta,40)/1000,editing=this.isEditing()
    if(editing||document.hidden){this.touchDirection='';this.attackHeld=false;return}
    if(time<this.introUntil||this.downed||this.finishing){this.updateHud();return}
    if(!this.climbing){
      const direction=new Phaser.Math.Vector2((this.cursors.right.isDown||this.keys.D.isDown||this.touchDirection==='right'?1:0)-(this.cursors.left.isDown||this.keys.A.isDown||this.touchDirection==='left'?1:0),(this.cursors.down.isDown||this.keys.S.isDown||this.touchDirection==='down'?1:0)-(this.cursors.up.isDown||this.keys.W.isDown||this.touchDirection==='up'?1:0))
      if(direction.lengthSq()){
        direction.normalize();this.facing.copy(direction)
        const speed=this.jumping?165:135, nextX=Phaser.Math.Clamp(this.hero.x+direction.x*speed*dt,66,588),nextY=Phaser.Math.Clamp(this.hero.y+direction.y*speed*dt,this.floor?115:300,this.floor?190:380)
        const blocked=!this.jumping&&this.obstacles.some(o=>o.floor===this.floor&&o.solid&&Phaser.Geom.Rectangle.Contains(o.rect,nextX,nextY))
        if(!blocked){this.hero.setPosition(nextX,nextY)}else if(time>this.obstaclePrompt){this.obstaclePrompt=time+3500;this.message('Crate ahead! Press Shift / K or Jump to leap over it.')}
        if(Math.abs(direction.x)>.1){this.hero.setFlipX(direction.x<0);this.hero.play('faune-run-side',true)}else this.hero.play(direction.y<0?'faune-run-up':'faune-run-down',true)
      }else{const key=this.hero.anims.currentAnim?.key||'faune-idle-side';this.hero.play(key.replace('run','idle'),true)}
      if(this.cursors.space.isDown||this.keys.J.isDown||this.attackHeld)this.swing()
      if(this.floor===1&&this.hero.x>570&&this.hero.y<163&&quest.levels[quest.current].completed&&quest.levels[quest.current].combatWon){nextRoom();return}
    }
    this.hero.setOrigin(.5,.5+this.jumpOffset/(this.hero.height*this.hero.scaleY));this.heroShadow.setPosition(this.hero.x,this.hero.y+12).setScale(this.jumping ? .65 : 1)
    if(!this.jumping&&!this.climbing&&this.obstacles.some(o=>o.floor===this.floor&&!o.solid&&Phaser.Geom.Rectangle.Contains(o.rect,this.hero.x,this.hero.y)))this.damage()
    if(time>this.lastDamage+300)this.hero.clearTint()
    this.enemies.forEach(enemy=>{
      if(enemy.hp<=0||enemy.staggered)return
      const sprite=enemy.sprite
      if(time>enemy.hitUntil)sprite.clearTint()
      if(enemy.floor===this.floor&&!this.climbing){
        const dx=this.hero.x-sprite.x,dy=this.hero.y-sprite.y,distance=Math.hypot(dx,dy)
        if(distance>17&&distance<440&&time>enemy.hitUntil){const speed=enemy.boss?28:enemy.creature!.speed;sprite.x+=dx/distance*speed*dt;sprite.y+=dy/distance*speed*dt;sprite.setFlipX(dx<0)}
        if(distance<(enemy.boss?35:22))this.damage()
        if((enemy.boss||enemy.creature?.ranged)&&time>enemy.nextShot){enemy.nextShot=time+1900;this.castBolt(enemy)}
      }else if(!this.climbing){sprite.x+=Math.sin(time/850+enemy.floor)*8*dt}
      enemy.shield.setPosition(sprite.x,sprite.y);enemy.label.setPosition(sprite.x,sprite.y-(enemy.boss?58:30))
      if(enemy.boss)enemy.shield.setRotation(time/1000)
    })
    this.bolts=this.bolts.filter(b=>{if(time>b.until){b.sprite.destroy();return false}if(!this.climbing){b.sprite.x+=b.vx*dt;b.sprite.y+=b.vy*dt;if(this.floor===b.floor&&Phaser.Math.Distance.Between(this.hero.x,this.hero.y,b.sprite.x,b.sprite.y)<18){this.damage();b.sprite.destroy();return false}}return true})
    this.updateHud()
  }
}
