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
        
        // Add Detect MAC button
        const detectButton = new Gtk.Button({
            label: _('Detect MAC'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
            margin_start: 8,
            margin_end: 8,
        });
        
        detectButton.connect('clicked', () => {
            const ip = settings.get_string('serverip');
            if (!ip || ip === '') {
                this._showError(_('Please enter a valid IP address first'));
                return;
            }
            
            // Try to detect MAC address using ip neigh command
            try {
                const proc = Gio.Subprocess.new(
                    ['ip', 'neigh', 'show', ip],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        if (proc.get_successful()) {
                            // Parse output to find MAC address
                            const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                            if (macMatch && macMatch[0]) {
                                const macAddress = macMatch[0].toLowerCase();
                                serverMACRow.set_text(macAddress);
                                settings.set_string('servermac', macAddress);
                                this._showSuccess(_('MAC address detected and applied'));
                            } else {
                                // Try alternative with arp command
                                this._detectWithArp(ip, serverMACRow, settings);
                            }
                        } else {
                            this._detectWithArp(ip, serverMACRow, settings);
                        }
                    } catch (e) {
                        this._detectWithArp(ip, serverMACRow, settings);
                    }
                });
            } catch (e) {
                this._detectWithArp(ip, serverMACRow, settings);
            }
        });
        
        serverMACRow.add_suffix(detectButton);
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
    
    _detectWithArp(ip, serverMACRow, settings) {
        try {
            const proc = Gio.Subprocess.new(
                ['arp', '-n', ip],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (proc.get_successful()) {
                        // Parse output to find MAC address
                        const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                        if (macMatch && macMatch[0]) {
                            const macAddress = macMatch[0].toLowerCase();
                            serverMACRow.set_text(macAddress);
                            settings.set_string('servermac', macAddress);
                            this._showSuccess(_('MAC address detected and applied'));
                        } else {
                            this._showError(_('Could not detect MAC address for the given IP'));
                        }
                    } else {
                        this._showError(_('Could not detect MAC address for the given IP'));
                    }
                } catch (e) {
                    this._showError(_('Error detecting MAC address: ') + e.message);
                }
            });
        } catch (e) {
            this._showError(_('Error executing ARP command: ') + e.message);
        }
    }
    
    _showError(message) {
        const dialog = new Adw.MessageDialog({
            heading: _('Error'),
            body: message,
            modal: true,
        });
        dialog.add_response('ok', _('OK'));
        dialog.present();
    }
    
    _showSuccess(message) {
        const dialog = new Adw.MessageDialog({
            heading: _('Success'),
            body: message,
            modal: true,
        });
        dialog.add_response('ok', _('OK'));
        dialog.present();
    }
} 