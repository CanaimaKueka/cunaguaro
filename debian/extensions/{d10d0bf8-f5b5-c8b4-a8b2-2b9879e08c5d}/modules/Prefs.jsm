/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * The Original Code is Adblock Plus.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * @fileOverview Manages Adblock Plus preferences.
 */

var EXPORTED_SYMBOLS = ["Prefs"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let baseURL = Cc["@adblockplus.org/abp/private;1"].getService(Ci.nsIURI);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import(baseURL.spec + "Utils.jsm");

const prefRoot = "extensions.adblockplus.";

/**
 * Will be set to true if Adblock Plus is scheduled to be uninstalled on
 * browser restart.
 * @type Boolean
 */
let willBeUninstalled = false;

/**
 * Preferences branch containing Adblock Plus preferences.
 * @type nsIPrefBranch
 */
let branch = Utils.prefService.getBranch(prefRoot);

/**
 * List of listeners to be notified whenever preferences are updated
 * @type Array of Function
 */
let listeners = [];

/**
 * This object allows easy access to Adblock Plus preferences, all defined
 * preferences will be available as its members.
 * @class
 */
var Prefs =
{
	/**
	 * Will be set to true if the user enters private browsing mode.
	 * @type Boolean
	 */
	privateBrowsing: false,

	/**
	 * Called on module startup.
	 */
	startup: function()
	{

	
		// Initialize prefs list
		let defaultBranch = this.getDefaultBranch();
		for each (let name in defaultBranch.getChildList("", {}))
		{
			let type = defaultBranch.getPrefType(name);
			switch (type)
			{
				case Ci.nsIPrefBranch.PREF_INT:
					defineIntegerProperty(name);
					break;
				case Ci.nsIPrefBranch.PREF_BOOL:
					defineBooleanProperty(name);
					break;
				case Ci.nsIPrefBranch.PREF_STRING:
					defineStringProperty(name);
					break;
			}
			if ("_update_" + name in PrefsPrivate)
				PrefsPrivate["_update_" + name]();
		}

		// Always disable object tabs in Fennec, they aren't usable
		if (Utils.appID == "{a23983c0-fd0e-11dc-95ff-0800200c9a66}")
			Prefs.frameobjects = false;


	
		// Register observers

		registerObservers();
	

	},

	/**
	 * Retrieves the preferences branch containing default preference values.
	 */
	getDefaultBranch: function() /**nsIPreferenceBranch*/
	{
		return Utils.prefService.getDefaultBranch(prefRoot);
	},

	/**
	 * Called on module shutdown.
	 */
	shutdown: function()
	{


		if (willBeUninstalled)
		{
			// Make sure that a new installation after uninstall will be treated like
			// an update.
			try {
				branch.clearUserPref("currentVersion");
			} catch(e) {}
		}


	},

	/**
	 * Adds a preferences listener that will be fired whenever preferences are
	 * reloaded
	 */
	addListener: function(/**Function*/ listener)
	{
		let index = listeners.indexOf(listener);
		if (index < 0)
			listeners.push(listener);
	},
	/**
	 * Removes a preferences listener
	 */
	removeListener: function(/**Function*/ listener)
	{
		let index = listeners.indexOf(listener);
		if (index >= 0)
			listeners.splice(index, 1);
	}
};

/**
 * Private nsIObserver implementation
 * @class
 */
var PrefsPrivate =
{
	/**
	 * If set to true notifications about preference changes will no longer cause
	 * a reload. This is to prevent unnecessary reloads while saving.
	 * @type Boolean
	 */
	ignorePrefChanges: false,

	/**
	 * nsIObserver implementation
	 */
	observe: function(subject, topic, data)
	{
		if (topic == "private-browsing")
		{
			if (data == "enter")
				Prefs.privateBrowsing = true;
			else if (data == "exit")
				Prefs.privateBrowsing = false;
		}
		else if (topic == "em-action-requested")
		{
			if (subject instanceof Ci.nsIUpdateItem && subject.id == Utils.addonID)
				willBeUninstalled = (data == "item-uninstalled");
		}
		else if (topic == "nsPref:changed" && !this.ignorePrefChanges && "_update_" + data in PrefsPrivate)
			PrefsPrivate["_update_" + data]();
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
}

/**
 * Adds observers to keep various properties of Prefs object updated.
 */
function registerObservers()
{
	// Observe preferences changes
	try {
		branch.QueryInterface(Ci.nsIPrefBranchInternal)
					.addObserver("", PrefsPrivate, true);
	}
	catch (e) {
		Cu.reportError(e);
	}

	let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(PrefsPrivate, "em-action-requested", true);

	// Add Private Browsing observer
	if ("@mozilla.org/privatebrowsing;1" in Cc)
	{
		try
		{
			Prefs.privateBrowsing = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService).privateBrowsingEnabled;
			observerService.addObserver(PrefsPrivate, "private-browsing", true);
		}
		catch(e)
		{
			Cu.reportError(e);
		}
	}
}

/**
 * Triggers preference listeners whenever a preference is changed.
 */
function triggerListeners(/**String*/ name)
{
	for each (let listener in listeners)
		listener(name);
}

/**
 * Sets up getter/setter on Prefs object for preference.
 */
function defineProperty(/**String*/ name, defaultValue, /**Function*/ readFunc, /**Function*/ writeFunc)
{
	let value = defaultValue;
	PrefsPrivate["_update_" + name] = function()
	{
		try
		{
			value = readFunc();
			triggerListeners(name);
		}
		catch(e)
		{
			Cu.reportError(e);
		}
	}
	Prefs.__defineGetter__(name, function() value);
	Prefs.__defineSetter__(name, function(newValue)
	{
		if (value == newValue)
			return value;

		try
		{
			PrefsPrivate.ignorePrefChanges = true;
			writeFunc(newValue);
			value = newValue;
			triggerListeners(name);
		}
		catch(e)
		{
			Cu.reportError(e);
		}
		finally
		{
			PrefsPrivate.ignorePrefChanges = false;
		}
		return value;
	});
}

/**
 * Sets up getter/setter on Prefs object for an integer preference.
 */
function defineIntegerProperty(/**String*/ name)
{
	defineProperty(name, 0, function() branch.getIntPref(name),
													function(newValue) branch.setIntPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a boolean preference.
 */
function defineBooleanProperty(/**String*/ name)
{
	defineProperty(name, false, function() branch.getBoolPref(name),
															function(newValue) branch.setBoolPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a string preference.
 */
function defineStringProperty(/**String*/ name)
{
	defineProperty(name, "", function() branch.getComplexValue(name, Ci.nsISupportsString).data,
		function(newValue)
		{
			let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
			str.data = newValue;
			branch.setComplexValue(name, Ci.nsISupportsString, str);
		});
}