/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is MitM Me.
 *
 * The Initial Developer of the Original Code is
 * Johnathan Nightingale.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var mitmme = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("new_mitm-me-strings");
    
    window.setTimeout(new_mitm-me.delayedStartup, 0);
  },

  delayedStartup: function() {
    // Add click handler in place of browser's
    gBrowser.removeEventListener("command", BrowserOnCommand, false);
    gBrowser.addEventListener("command", mitmme.onCommand, false);

    // Add styling mods
    var styleSheetService = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                                      .getService(Components.interfaces.nsIStyleSheetService);
    styleSheetService.loadAndRegisterSheet(makeURI("chrome://new_mitm-me/content/content-style.css"),
                                           Components.interfaces.nsIStyleSheetService.USER_SHEET);

  },

  onCommand: function(event) {
    // Don't trust synthetic events
    if (!event.isTrusted)
      return;

    var ot = event.originalTarget;
    var errorDoc = ot.ownerDocument;
    var uri = gBrowser.currentURI;

    // If the event came from an ssl error page, and is the "Add Exception" button...
    // optional semi-automatic "Add Exception" button event...
    // FF3.5 support: about:certerror
    if (/^about:neterror\?e=nssBadCert/.test(errorDoc.documentURI)) {

      if (ot == errorDoc.getElementById('exceptionDialogButton')) {

        // Get the cert
        var recentCertsSvc = Components.classes["@mozilla.org/security/recentbadcerts;1"]
                            .getService(Components.interfaces.nsIRecentBadCertsService);

        var hostWithPort = uri.host + ":" + uri.port;
        gSSLStatus = gBrowser.securityUI
                                .QueryInterface(Components.interfaces.nsISSLStatusProvider)
                                .SSLStatus;
        if(!gSSLStatus) {
          try {
            var recentCertsSvc = Components.classes["@mozilla.org/security/recentbadcerts;1"]
                                 .getService(Components.interfaces.nsIRecentBadCertsService);
            if (!recentCertsSvc)
              return;

            var hostWithPort = uri.host + ":" + uri.port;
            gSSLStatus = recentCertsSvc.getRecentBadCert(hostWithPort);
          }
          catch (e) {
            Components.utils.reportError(e);
            return;
          }
        }

        if(!gSSLStatus)
          mitmme.getCert(uri);

        if(!gSSLStatus) {
          Components.utils.reportError("MITMME - No gSSLStatus on attempt to add exception")
          return;
        }

        gCert = gSSLStatus.QueryInterface(Components.interfaces.nsISSLStatus).serverCert;
        if(!gCert){
          Components.utils.reportError("MITMME - No gCert on attempt to add exception")
          return;
        }
        // Add the exception
        var overrideService = Components.classes["@mozilla.org/security/certoverride;1"]
                                        .getService(Components.interfaces.nsICertOverrideService);
        var flags = 0;
        if(gSSLStatus.isUntrusted)
          flags |= overrideService.ERROR_UNTRUSTED;
        if(gSSLStatus.isDomainMismatch)
          flags |= overrideService.ERROR_MISMATCH;
        if(gSSLStatus.isNotValidAtThisTime)
          flags |= overrideService.ERROR_TIME;

        overrideService.rememberValidityOverride(
          uri.asciiHost, uri.port,
          gCert,
          flags,
          gPrefService.getBoolPref("extensions.new_mitm-me.add_temporary_exceptions"));

        // Eat the event
        event.stopPropagation();

        // Reload the page
        if(errorDoc && errorDoc.location)
          errorDoc.location.reload();
      } else {
        BrowserOnCommand(event);
      }
    } else {
      BrowserOnCommand(event);
    }
  },

  // Lifted from exceptionDialog.js in PSM
  getCert: function(uri) {
    var req = new XMLHttpRequest();
    try {
      if(uri) {
        req.open('GET', uri.prePath, false);
        req.channel.notificationCallbacks = new badCertListener();
        req.send(null);
      }
    } catch (e) {
      // We *expect* exceptions if there are problems with the certificate
      // presented by the site.  Log it, just in case, but we can proceed here,
      // with appropriate sanity checks
      Components.utils.reportError("MITMME: Attempted to connect to a site with a bad certificate. " +
                                   "This results in a (mostly harmless) exception being thrown. " +
                                   "Logged for information purposes only: " + e);
    } finally {
      gChecking = false;
    }

    if(req.channel && req.channel.securityInfo) {
      const Ci = Components.interfaces;
      gSSLStatus = req.channel.securityInfo
                      .QueryInterface(Ci.nsISSLStatusProvider).SSLStatus;
      gCert = gSSLStatus.QueryInterface(Ci.nsISSLStatus).serverCert;
    }
  }

};

// Simple badcertlistener lifted from exceptionDialog.js in PSM
function badCertListener() {}
badCertListener.prototype = {
  getInterface: function (aIID) {
    return this.QueryInterface(aIID);
  },
  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIBadCertListener2) ||
        aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
  handle_test_result: function () {
    if (gSSLStatus)
      gCert = gSSLStatus.QueryInterface(Components.interfaces.nsISSLStatus).serverCert;
  },
  notifyCertProblem: function MSR_notifyCertProblem(socketInfo, sslStatus, targetHost) {
    gBroken = true;
    gSSLStatus = sslStatus;
    this.handle_test_result();
    return true; // suppress error UI
  }
}


window.addEventListener("load", function(e) { mitmme.onLoad(e); }, false);
