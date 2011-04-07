new_mitm_me.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ new_mitm_me.showFirefoxContextMenu(e); }, false);
};

new_mitm_me.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-new_mitm_me").hidden = gContextMenu.onImage;
};

window.addEventListener("load", new_mitm_me.onFirefoxLoad, false);
