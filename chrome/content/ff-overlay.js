mitm-me.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ mitm-me.showFirefoxContextMenu(e); }, false);
};

mitm-me.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-mitm-me").hidden = gContextMenu.onImage;
};

window.addEventListener("load", mitm-me.onFirefoxLoad, false);
