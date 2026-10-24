'use strict';
document.addEventListener('DOMContentLoaded', () => {
 const main = document.getElementById('shop-detail-photo');
 if (!main) return;
 document.querySelectorAll('.shop-detail-thumb').forEach(button => {
  button.addEventListener('click', () => {
   const url=button.dataset.photo;
   try {const parsed=new URL(url);if(parsed.protocol!=='https:')return;}catch(_){return;}
   main.hidden=false;const placeholder=main.nextElementSibling;if(placeholder)placeholder.hidden=true;
   main.src=url;main.alt=button.dataset.alt || '';
   document.querySelectorAll('.shop-detail-thumb').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});
   button.classList.add('is-selected');button.setAttribute('aria-pressed','true');
  });
 });
});
