// The whole fire. Fourier 1822, finite differences, a random boundary at the bottom.
const c=document.querySelector('canvas'),g=c.getContext('2d'),W=c.width=160,H=c.height=100,h=new Float32Array(W*(H+2)),img=g.createImageData(W,H),p=img.data;
(function frame(){
  for(let x=0;x<W;x++)h[H*W+x]=h[(H+1)*W+x]=Math.random()<.5?1:0;            // source: embers at the bottom, on or off
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){                                  // every cell looks one row down (the updraft)
    const j=(y+1)*W+x+(Math.random()*3|0)-1,s=.7*(h[j]||0)+.15*(h[j-1]||0)+.15*(h[j+1]||0); // a random step sideways, then blur (the diffusion)
    h[y*W+x]=Math.max(0,s-.02*Math.random());                                // and cools a little (the decay)
  }
  for(let i=0;i<W*H;i++){const v=3*h[i];p[4*i]=255*Math.min(1,v);p[4*i+1]=255*Math.max(0,Math.min(1,v-1));p[4*i+2]=255*Math.max(0,v-2);p[4*i+3]=255}
  g.putImageData(img,0,0);requestAnimationFrame(frame)
})()
