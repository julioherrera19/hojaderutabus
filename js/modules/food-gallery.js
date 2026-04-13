/**
 * Mini galería de platos - KISS: auto-scroll nativo
 */
export function initFoodGallery() {
    const gallery = document.getElementById('foodGallery');
    if (!gallery) return;

    let dir = 1;
    setInterval(() => {
        const maxScroll = gallery.scrollWidth - gallery.clientWidth;
        if (gallery.scrollLeft >= maxScroll - 2) dir = -1;
        if (gallery.scrollLeft <= 2) dir = 1;
        gallery.scrollBy({ left: dir * gallery.clientWidth * 0.6, behavior: 'smooth' });
    }, 2500);
}
