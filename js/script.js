(function($) {

    "use strict";

    $(document).ready(function() {
      
      // masonoary //

      initIsotope();

      // lightbox

      lightbox.option({
        'resizeDuration': 200,
        'wrapAround': true,
        'fitImagesInViewport': true
      })
      
      /* swiper */
      

      var testimonialSwiper = new Swiper(".testimonial-swiper", {
        spaceBetween: 20,
        pagination: {
            el: ".testimonial-swiper-pagination",
            clickable: true,
          },
        breakpoints: {
          0: {
            slidesPerView: 1,
          },
          800: {
            slidesPerView: 3,
          },
          1400: {
            slidesPerView: 3,
          }
        },
      });

      // GSAP parallax for portfolio preview cards
      if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);

        var createParallax = function(strength) {
          var thumbs = document.querySelectorAll('.portfolio-preview-thumb');
          if (!thumbs.length) return;

          thumbs.forEach(function(thumb, index) {
            var direction = index % 2 === 0 ? 1 : -1;
            var movement = direction * strength;

            gsap.fromTo(
              thumb,
              { yPercent: movement * -0.35 },
              {
                yPercent: movement,
                ease: "none",
                scrollTrigger: {
                  trigger: thumb,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.6,
                  invalidateOnRefresh: true
                }
              }
            );
          });
        };

        ScrollTrigger.matchMedia({
          "(max-width: 767px)": function() {
            createParallax(8);
          },
          "(min-width: 768px)": function() {
            createParallax(16);
          }
        });

        // GSAP rolling counter + float-in for stats
        var statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(function(stat) {
          var target = parseInt(stat.getAttribute('data-target'), 10) || 0;
          var counter = { value: 0 };

          gsap.fromTo(
            counter,
            { value: 0 },
            {
              value: target,
              duration: 1.4,
              ease: "power2.out",
              onUpdate: function() {
                stat.textContent = Math.floor(counter.value);
              },
              onComplete: function() {
                stat.textContent = target;
              },
              scrollTrigger: {
                trigger: stat,
                start: "top 85%",
                once: true
              }
            }
          );

          gsap.fromTo(
            stat,
            { yPercent: 30, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: stat,
                start: "top 90%",
                once: true
              }
            }
          );
        });

        // GSAP image reveal for slow-loading previews (Apple-like)
        var previewImages = document.querySelectorAll('.portfolio-preview-thumb');
        previewImages.forEach(function(img) {
          var wrapper = img.closest('.portfolio-preview');
          if (wrapper) {
            wrapper.classList.remove('is-loaded');
          }

          gsap.set(img, { opacity: 0, scale: 1.04, filter: "blur(14px)" });

          var runReveal = function() {
            if (wrapper) {
              wrapper.classList.add('is-loaded');
            }
            gsap.to(img, {
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              duration: 2,
              ease: "power2.out"
            });
          };

          if (img.complete && img.naturalWidth !== 0) {
            runReveal();
          } else {
            img.addEventListener('load', runReveal, { once: true });
            img.addEventListener('error', function() {
              if (wrapper) wrapper.classList.add('is-loaded');
            }, { once: true });
          }
        });
      }

    }); // End of a document ready

  // init Isotope
  var initIsotope = function() {
    
    $('.grid').each(function(){

      // $('.grid').imagesLoaded( function() {
        // images have loaded
        var $buttonGroup = $( '.button-group' );
        var $checked = $buttonGroup.find('.is-checked');
        var filterValue = $checked.attr('data-filter');
  
        var $grid = $('.grid').isotope({
          itemSelector: '.portfolio-item',
          // layoutMode: 'fitRows',
          filter: filterValue
        });
    
        // bind filter button click
        $('.button-group').on( 'click', 'a', function(e) {
          e.preventDefault();
          filterValue = $( this ).attr('data-filter');
          $grid.isotope({ filter: filterValue });
        });
    
        // change is-checked class on buttons
        $('.button-group').each( function( i, buttonGroup ) {
          $buttonGroup.on( 'click', 'a', function() {
            $buttonGroup.find('.is-checked').removeClass('is-checked');
            $( this ).addClass('is-checked');
          });
        });
      // });

    });
  }




})(jQuery);
