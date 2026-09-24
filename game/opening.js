// Illustrated prologue; never mutates movement, saves or campaign progression.
export const STORY=[
 {heading:'A village built on a breath.',text:'Bellhollow grows in the arms of one colossal tree. Paired bells borrow its wind: it turns the mills, lifts the bridges and wakes the morning.'},
 {heading:'This morning, silence.',text:'The windmills have stopped. Deep in the Hollow, an old guardian has shuttered the windworks. The tree is holding its breath.'},
 {heading:'One keeper. One apprentice.',text:'Mara can hold the bypass open for a while. Her bell staff is yours now—and somewhere below, the wind is trying to say something.'}
];
export function createOpening(){
 const $=s=>document.querySelector(s);let card=-1;
 function begin(skip=false){$('#titleSound').hidden=true;$('#titleFootnote').hidden=true;$('#titleArt').hidden=skip;$('#prologue').hidden=skip;document.body.classList.remove('at-title');document.body.classList.toggle('in-prologue',!skip);card=-1;if(!skip)update(0);}
 function update(t){const i=Math.floor(t/9),active=i<3;$('#prologue').hidden=!active;$('#titleArt').hidden=!active;document.body.classList.toggle('in-prologue',active);if(!active)return;if(i!==card){card=i;$('#storyNumber').textContent=`PROLOGUE / ${String(i+1).padStart(2,'0')} OF 03`;$('#storyHeading').textContent=STORY[i].heading;$('#storyText').textContent=STORY[i].text;$('#storyNext').textContent=i===2?'Enter Bellhollow →':'Continue the story →';$('#prologue').dataset.chapter=String(i);$('#titleArt').dataset.chapter=String(i);}$('#prologue').style.setProperty('--story-progress',String((t%9)/9));}
 function end(){for(const id of ['prologue','titleArt','titleSound','titleFootnote'])$('#'+id).hidden=true;document.body.classList.remove('at-title','in-prologue');}
 document.body.classList.add('at-title');
 return {begin,update,end};
}
