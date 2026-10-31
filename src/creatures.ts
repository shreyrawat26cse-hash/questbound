import Phaser from 'phaser'
export type Creature = { name:string; texture:string; animation:string; speed:number; kind:string; color:number; ranged:boolean }
export function creatureFor(scene:Phaser.Scene,index:number):Creature {
  const kinds=['lizard','slime','bat','skeleton','imp','spider']
  const kind=kinds[index%kinds.length]
  if(kind==='lizard')return{name:'MOSS LIZARD',texture:'lizard',animation:'lizard-run',speed:34,kind,color:0xa8cb7e,ranged:false}
  const colors:Record<string,number>={slime:0x70c5b0,bat:0xada1db,skeleton:0xded5bc,imp:0xe8a077,spider:0x8ec2d0}
  for(let frame=0;frame<2;frame++){
    const key=`creature-${kind}-${frame}`;if(scene.textures.exists(key))continue
    const g=scene.make.graphics({x:0,y:0}),c=colors[kind]
    if(kind==='slime'){
      g.fillStyle(0x2e6c69);g.fillRect(5,19+frame*2,23,10-frame*2);g.fillStyle(c);g.fillRect(7-frame*2,14+frame*3,19+frame*4,11);g.fillRect(11,10+frame*3,11,6);g.fillStyle(0xb8f0cc);g.fillRect(10,15+frame*3,5,3)
    }else if(kind==='bat'){
      g.fillStyle(0x635c8f);g.fillTriangle(13,16,0,frame?26:5,2,22);g.fillTriangle(20,16,32,frame?26:5,30,22);g.fillStyle(c);g.fillRect(11,12,11,13);g.fillTriangle(11,13,11,5,16,12);g.fillTriangle(18,12,22,5,22,13)
    }else if(kind==='skeleton'){
      g.fillStyle(c);g.fillRect(10,5,13,12);g.fillRect(12,18,9,3);g.fillRect(15,19,3,10);g.fillRect(9,22,16,3);g.fillRect(9+frame*2,27,5,5);g.fillRect(21-frame*2,27,5,5);g.fillStyle(0x44404d);g.fillRect(12,9,3,4);g.fillRect(18,9,3,4);g.fillRect(14,15,6,2);g.fillStyle(0xc5b891);g.fillRect(26,14,3,15)
    }else if(kind==='imp'){
      g.fillStyle(0xa44f55);g.fillTriangle(8,13,7,1,14,13);g.fillTriangle(20,13,26,1,25,13);g.fillStyle(c);g.fillRect(9,11,16,11);g.fillRect(11,22,12,9);g.fillRect(7,27+frame,7,5);g.fillRect(22,27-frame,7,5);g.fillStyle(0xffd681);g.fillRect(1,17+frame*3,5,7)
    }else{
      g.fillStyle(0x527b8a);for(let i=0;i<3;i++){g.fillRect(1,10+i*7+frame,9,3);g.fillRect(23,10+i*7-frame,9,3);g.fillRect(2+i,7+i*8,3,8);g.fillRect(28-i,7+i*8,3,8)}g.fillStyle(c);g.fillRect(9,11,15,16);g.fillRect(12,7,9,8)
    }
    if(kind!=='skeleton'){g.fillStyle(0x1b2631);g.fillRect(12,kind==='slime'?20+frame*2:15,3,3);g.fillRect(20,kind==='slime'?20+frame*2:15,3,3)}
    g.generateTexture(key,34,36);g.destroy()
  }
  const animation=`creature-${kind}-move`
  if(!scene.anims.exists(animation))scene.anims.create({key:animation,frames:[{key:`creature-${kind}-0`},{key:`creature-${kind}-1`}],frameRate:kind==='bat'?9:5,repeat:-1})
  return{name:({slime:'GLOW SLIME',bat:'DUSK BAT',skeleton:'BONE SENTINEL',imp:'EMBER IMP',spider:'FROST SPIDER'} as Record<string,string>)[kind],texture:`creature-${kind}-0`,animation,speed:kind==='bat'?43:kind==='slime'?29:kind==='spider'?39:33,kind,color:colors[kind],ranged:kind==='imp'}
}
