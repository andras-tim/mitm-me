/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

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
 * Developer:
 * Andras Tim <andras.tim@gmail.com> All Rights Reserved.
 *
 * Contributor(s):
 * Foudil Brétel <foudil.newbie@bigfoot.com>
 * Johnathan Nightingale (the original addon's developer @ 2008)
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

var mitm_me = {
  DEBUG_MODE: true,

  onWindowLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("mitm-me-strings");

    // Set up preference change observer
    this._prefService =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
      .getBranch("extensions.mitm-me.");
    this._prefService.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this._prefService.addObserver("", this, false);

    //gBrowser.removeEventListener("click", BrowserOnClick, false);
    gBrowser.addEventListener("click", this.onCommand, false);
    document.getElementById("content").addEventListener("DOMLinkAdded", this.onPageLoad, false);

    var silent = this._prefService.getBoolPref("silent_mode");
    this.dump('silent_mode: '+silent);
    if (silent)
      document.getElementById("content")
      .addEventListener("DOMLinkAdded", this.onCommand, false);
  },

  onPageLoad: function(event) {
    var ot = event.originalTarget;
    var errorDoc = ot.ownerDocument;
    var uri = gBrowser.currentURI;

    mitm_me.dump("originalTarget:");
    mitm_me.dumpObj(ot.ownerDocument);

    // If the event came from an ssl error page
    // optional semi-automatic "Add Exception" button event...
    // FF3.5 support: about:certerror
    if (! (/^about:neterror\?e=nssBadCert/.test(errorDoc.documentURI)
     || /^about:certerror/.test(errorDoc.documentURI)))
    {
      BrowserOnClick(event);
      return;
    }

    var edb = errorDoc.getElementById('exceptionDialogButton');
    if (edb)
      edb.id = 'exceptionDialogButton_ModifiedByMitMMe';
  },

  onCommand: function(event) {
    var ot = event.originalTarget;
    var errorDoc = ot.ownerDocument;
    var uri = gBrowser.currentURI;

    // Don't trust synthetic events
    if (!event.isTrusted)
    {
      BrowserOnClick(event);
      return;
    }

    if (!(ot == errorDoc.getElementById('exceptionDialogButton_ModifiedByMitMMe') || mitm_me._prefService.getBoolPref("silent_mode")))
    {
      BrowserOnClick(event);
      return;
    }

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
      mitm_me.getCert(uri);

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
      mitm_me._prefService.getBoolPref("add_temporary_exceptions"));

    // Eat the event
    event.stopPropagation();

    // Reload the page
    if(errorDoc && errorDoc.location)
      errorDoc.location.reload();
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
      // presented by the site. Log it, just in case, but we can proceed here,
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
  },

  onQuit: function() {
    // Remove observer
    this._prefService.QueryInterface(Ci.nsIPrefBranch2);
    this._prefService.removeObserver("", this);
  },


  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    this.dump('Pref changed: '+data);

    // switch(data) {
    // case 'context':
    // case 'replace_builtin':
    //   this.updateUIFromPrefs();
    //   break;
    // }
  },

  /* Console logging functions */
  // TODO: use Web console (C-S-k)
  dump: function(message) { // Debuging function -- prints to javascript console
    if(!this.DEBUG_MODE) return;
    var ConsoleService = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
    ConsoleService.logStringMessage(message);
  },
  dumpObj: function(obj) {
    if(!this.DEBUG_MODE) return;
    var str = "";
    for(i in obj) {
      try {
        str += "obj["+i+"]: " + obj[i] + "\n";
      } catch(e) {
        str += "obj["+i+"]: Unavailable\n";
      }
    }
    this.dump(str);
  },

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

window.addEventListener("load", function () { mitm_me.onWindowLoad(); }, false);
