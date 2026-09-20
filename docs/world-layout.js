import {height,PATH} from './assets/terrain.js';
export {height,PATH,TERRAIN,SHORELINES,isLand,isIsland,terrainGround,ridgeBlocked,shoreClearance,shoreDistance} from './assets/terrain.js';
export const START=[-1,height(-1,18),18];
export const POINTS={cottage:[-8,8],wheel:[6,2.5],garden:[-13.2,-17.5],quietGarden:[-7,-18.5],porch:[-6.5,11],chime:[-9.5,-14.5],keepsake:[-19,-5],overlook:[8,-11.3]};
export function pathDistance(x,z){let best=1e9;for(let i=1;i<PATH.length;i++){const a=PATH[i-1],b=PATH[i],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
