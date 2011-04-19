// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.mitm-me@andras.tim.description", "chrome://new_mitm-me/locale/overlay.properties");

//Extension prefs
pref("extensions.new_mitm-me.enabled", true);
pref("extensions.new_mitm-me.add_temporary_exceptions", true);
pref("extensions.new_mitm-me.silent_mode", false);

//Set the environment settings
pref("browser.ssl_override_behavior", 2);
pref("browser.xul.error_pages.expert_bad_cert", true);