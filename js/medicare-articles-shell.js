// Match the home page's menu and back-to-top behavior.
(function(){
  var btn=document.getElementById('v4HamburgerBtn');
  var closeBtn=document.getElementById('v4MobileClose');
  var menu=document.getElementById('v4-mobile-menu');
  if(btn&&menu){
    function closeMenu(){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');document.body.style.overflow='';}
    btn.addEventListener('click',function(){menu.classList.add('open');btn.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';});
    if(closeBtn)closeBtn.addEventListener('click',closeMenu);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu();});
  }
  var top=document.getElementById('scrollToTop');
  if(top){
    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.addEventListener('scroll',function(){top.style.display=window.pageYOffset>300?'flex':'none';});
    top.addEventListener('click',function(){window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});});
  }
})();
