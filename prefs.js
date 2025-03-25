import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class HomeServerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Use AdwPreferencesPage for modern preferences UI
        const page = new Adw.PreferencesPage();
        window.add(page);
        
        // Create a preferences group
        const group = new Adw.PreferencesGroup({
            title: _('Home Server Settings')
        });
        page.add(group);
        
        // Get settings
        const settings = this.getSettings();

        // Server IP
        const serverIPRow = new Adw.EntryRow({
            title: _('Server IP:'),
            text: settings.get_string('serverip')
        });
        serverIPRow.connect('changed', entry => {
            settings.set_string('serverip', entry.get_text());
        });
        group.add(serverIPRow);
        
        // Server MAC
        const serverMACRow = new Adw.EntryRow({
            title: _('Server MAC:'),
            text: settings.get_string('servermac')
        });
        serverMACRow.connect('changed', entry => {
            settings.set_string('servermac', entry.get_text());
        });
        group.add(serverMACRow);
        
        // Server Poll
        const serverPollRow = new Adw.ActionRow({
            title: _('Server Poll:'),
            subtitle: _('Time in seconds between server status checks')
        });
        const serverPollAdj = new Gtk.Adjustment({
            lower: 5,
            upper: 300,
            step_increment: 5,
            value: settings.get_int('serverpoll')
        });
        const serverPollSpinButton = new Gtk.SpinButton({
            adjustment: serverPollAdj,
            valign: Gtk.Align.CENTER
        });
        serverPollSpinButton.connect('value-changed', button => {
            settings.set_int('serverpoll', button.get_value());
        });
        serverPollRow.add_suffix(serverPollSpinButton);
        group.add(serverPollRow);
        
        // Debug Mode
        const debugRow = new Adw.ActionRow({
            title: _('Debug Mode:')
        });
        const debugSwitch = new Gtk.Switch({
            active: settings.get_boolean('serverdebug'),
            valign: Gtk.Align.CENTER
        });
        debugSwitch.connect('notify::active', widget => {
            settings.set_boolean('serverdebug', widget.get_active());
        });
        debugRow.add_suffix(debugSwitch);
        group.add(debugRow);
        
        // Version info
        const versionGroup = new Adw.PreferencesGroup();
        page.add(versionGroup);
        
        const version = `${this.metadata.version}.${this.metadata.minor}.${this.metadata.revision}`;
        const versionRow = new Adw.ActionRow({
            title: _('Version:'),
            subtitle: version
        });
        versionGroup.add(versionRow);
    }
} 