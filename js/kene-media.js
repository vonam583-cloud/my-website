/* Kể Nè — responsive local photographs; source metadata is bundled separately. */
(function(){
  'use strict';
  const K=window.KENE,M=window.KENE_MEDIA;
  if(!K||!M)return;
  K.mediaImage=function(key,alt,options){
    const asset=M.assets[key],o=options||{};
    if(!asset)return '<img src="img/scene-care.svg" alt="'+K.escape(alt||'Minh hoạ Kể Nè')+'" loading="lazy">';
    const text=K.escape(alt||asset.alt),sizes=K.escape(o.sizes||'(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw');
    return '<picture class="ke-picture '+K.escape(o.className||'')+'" data-ke-image="'+key+'">'+
      '<source type="image/webp" srcset="'+asset.small+' 960w, '+asset.large+' 1920w" sizes="'+sizes+'">'+
      '<img src="'+asset.src+'" alt="'+text+'" width="'+asset.width+'" height="'+asset.height+'" loading="'+(o.eager?'eager':'lazy')+'" decoding="async"'+(o.priority?' fetchpriority="high"':'')+' data-ke-photo="'+key+'"></picture>';
  };
  K.mediaFigure=function(key,caption,group,options){
    return '<figure class="ke-photo-frame ke-tilt">'+K.mediaImage(key,caption,options)+
      '<button class="ke-photo-zoom" type="button" data-ke-lightbox="'+K.escape(key)+'" data-ke-gallery="'+K.escape(group||'single')+'" aria-label="Xem ảnh lớn: '+K.escape(caption||'Ảnh minh hoạ')+'"><span aria-hidden="true">⤢</span></button>'+
      (caption?'<figcaption><strong>'+K.escape(caption)+'</strong></figcaption>':'')+'</figure>';
  };
})();
