import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const Status = {
    ONLINE: 1,
    OFFLINE: 2,
    ERROR: 3,
    UNDEFINED: 4,
};

const Icon = {
    ONLINE: 'online.svg',
    OFFLINE: 'offline.svg',
    ERROR: 'error.svg',
    UNDEFINED: 'undefined.svg',
};

const Settings = {
    SERVER_MAC: 'servermac',
    SERVER_IP: 'serverip',
    SERVER_POLL: 'serverpoll',
    SERVER_DEBUG: 'serverdebug',
};

const HomeServerIndicator = GObject.registerClass(
    class HomeServerIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, _('Server'));
            this._ext = extension;
            this._indicatorStatus = {
                lastResponse: null,
                status: Status.UNDEFINED,
            };
            this._settings = this._ext.getSettings();
            this._isConnected = false;
            this._setupWidgets();

            this._mainLoop();
            this._startMainLoop();
        }

        _setupWidgets() {
            this._menuLayout = new St.BoxLayout();
            this._ServerIcon = new St.Icon({ style_class: 'system-status-icon' });
            this._setIndicatorIcon(Icon.UNDEFINED);
            this._menuLayout.add_child(this._ServerIcon);
            this.add_child(this._menuLayout);
            this._setupPopupMenu();
        }

        _setupPopupMenu() {
            this._settingsMenuItem = new PopupMenu.PopupMenuItem(_('Settings'));
            this._settingsMenuItem.connect('activate', () => {
                this._ext.openPreferences();
            });
            this.menu.addMenuItem(this._settingsMenuItem);
        }

        _setIndicatorIcon(iconFileName) {
            const iconPath = GLib.build_filenamev([this._ext.path, 'icons', iconFileName]);
            this._ServerIcon.set_gicon(Gio.Icon.new_for_string(iconPath));
        }

        _setIndicator(status) {
            if (status == Status.ONLINE) {
                if (this._indicatorStatus.status !== Status.ONLINE) {
                    this._setIndicatorIcon(Icon.ONLINE);
                    this._log('Set status ONLINE');
                    this._indicatorStatus.status = Status.ONLINE;
                    if (this._wakeonlanMenuItem) {
                        this._log('Remove WOL menu item');
                        this._wakeonlanMenuItem.disconnect(this._wolSignalId);
                        this._wakeonlanMenuItem.destroy();
                        this._wakeonlanMenuItem = null;
                    }
                }
                return;
            }

            if (status == Status.OFFLINE) {
                if (this._indicatorStatus.status !== Status.OFFLINE) {
                    this._setIndicatorIcon(Icon.OFFLINE);
                    this._log('Set status OFFLINE');
                    this._indicatorStatus.status = Status.OFFLINE;
                    if (!this._wakeonlanMenuItem) {
                        this._log('Add WOL menu item');
                        this._wakeonlanMenuItem = new PopupMenu.PopupMenuItem(_('Start Server'));
                        this._wolSignalId = this._wakeonlanMenuItem.connect('activate', () => {
                            this._wakeup();
                        });
                        this.menu.addMenuItem(this._wakeonlanMenuItem);
                    }
                }
                return;
            }

            if (status == Status.ERROR) {
                if (this._indicatorStatus.status !== Status.ERROR) {
                    this._setIndicatorIcon(Icon.ERROR);
                    this._log('Set status ERROR');
                    this._indicatorStatus.status = Status.ERROR;
                    if (this._wakeonlanMenuItem) {
                        this._log('Remove WOL menu item');
                        this._wakeonlanMenuItem.disconnect(this._wolSignalId);
                        this._wakeonlanMenuItem.destroy();
                        this._wakeonlanMenuItem = null;
                    }
                }
                return;
            }

            if (status == Status.UNDEFINED) {
                if (this._indicatorStatus.status !== Status.UNDEFINED) {
                    this._setIndicatorIcon(Icon.UNDEFINED);
                    this._log('Set status UNDEFINED');
                    this._indicatorStatus.status = Status.UNDEFINED;
                    if (this._wakeonlanMenuItem) {
                        this._log('Remove WOL menu item');
                        this._wakeonlanMenuItem.disconnect(this._wolSignalId);
                        this._wakeonlanMenuItem.destroy();
                        this._wakeonlanMenuItem = null;
                    }
                }
                return;
            }
        }

        _wakeup() {
            try {
                let proc = Gio.Subprocess.new(
                    ['wakeonlan', this._settings.get_string(Settings.SERVER_MAC)],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        Main.notify(this._ext.metadata.name, _('Start Server now. Please wait...'));
                        let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    } catch (e) {
                        Main.notify(this._ext.metadata.name, _('Start Server failed'));
                        this._log('Executing Wake On LAN failed. ' + e);
                    }
                });
            } catch (e) {
                Main.notify(this._ext.metadata.name, _('Start Server failed. Already installed wakeonlan?'));
                this._log('Wake On LAN failed. Already installed wakeonlan? ' + e);
            }
        }

        _startMainLoop() {
            this._mainLoopTimeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                this._settings.get_int(Settings.SERVER_POLL),
                () => {
                    this._mainLoop();
                    return true;
                }
            );
        }

        _stopMainLoop() {
            if (this._mainLoopTimeout) {
                GLib.source_remove(this._mainLoopTimeout);
                this._mainLoopTimeout = null;
            }
            this._connection = null;
        }

        async _mainLoop() {
            let ip = this._settings.get_string(Settings.SERVER_IP);
            let cmd = [];
            if (this._isConnected == true) {
                this._log('Connection established');
                cmd = ['sh', '-c', `ping -q -c1 -w5 ${ip} >/dev/null 2>&1`];
            } else {
                this._log('Awaiting established connection');
                cmd = ['sh', '-c', 'ping -q -c1 -w1 `ip r | grep default | cut -d " " -f 3` >/dev/null 2>&1 && exit 0 || exit 1'];
            }

            try {
                let proc = Gio.Subprocess.new(
                    cmd,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        if (proc.get_successful()) {
                            if (this._isConnected == true) {
                                this._log('Ping success');
                                this._setIndicator(Status.ONLINE);
                            } else {
                                this._isConnected = true;
                                this._setIndicator(Status.UNDEFINED);
                            }
                        } else {
                            if (this._isConnected == true) {
                                this._log('Ping failed');
                                this._setIndicator(Status.OFFLINE);
                            } else {
                                this._log('Not yet connected to default gateway');
                                this._setIndicator(Status.ERROR);
                            }
                        }
                    } catch (e) {
                        this._log('Exception occurred on communicate_utf8_finish: ' + e);
                        this._setIndicator(Status.ERROR);
                    }
                });
            } catch (e) {
                this._log('Exception occurred on Subprocess.new: ' + e);
                this._setIndicator(Status.ERROR);
            }
        }

        _log(msg) {
            if (this._settings.get_boolean(Settings.SERVER_DEBUG))
                console.log(`[home-server] ${msg}`);
        }

        destroy() {
            this._stopMainLoop();
            super.destroy();
        }
    });

export default class HomeServerExtension extends Extension {
    enable() {
        this._indicator = new HomeServerIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
} 