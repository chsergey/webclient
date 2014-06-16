/**
 * How to make this work in your browser? copy/paste this in your browser console:
 * localStorage.staticpath = "http://localhost:5280/"; localStorage.dd=1; localStorage.contextmenu=1; localStorage.megachat=1; localStorage.jj=true;
 * and optionally:
 * localStorage.dxmpp = 1; localStorage.stopOnAssertFail = true; localStorage.d = 1;
 * @type {boolean}
 */
var MegaChatEnabled = true;
// Mega Chat is now ALWAYS ENABLED

//if (localStorage.megachat) {
//    MegaChatEnabled = true;
//}

var chatui;
(function() {
    chatui = function(id) {

        //TODO: move this code to MegaChat.constructor() and .show(jid)
        hideEmptyMsg();
        $('.fm-files-view-icon').addClass('hidden');
        $('.fm-blocks-view').addClass('hidden');
        $('.files-grid-view').addClass('hidden');
        $('.contacts-grid-view').addClass('hidden');
        $('.fm-contacts-blocks-view').addClass('hidden');
        $('.fm-right-account-block').addClass('hidden');

        $('.fm-right-files-block').removeClass('hidden');

        var chatJids = id.split("chat/").pop();
        if(chatJids) {
            chatJids = chatJids.split(",");
        } else {
            chatJids = [];
        }

        $.each(chatJids, function(k, v) {
            chatJids[k] = megaChat.getJidFromNodeId(v);
        });

        var $promise;


        if(localStorage.megaChatPresence != "unavailable") {
            if(megaChat.karere.getConnectionState() != Karere.CONNECTION_STATE.CONNECTED) {
                megaChat.connect()
                    .done(function() {


                    });
            } else {
            }


        } else {
            // XX: I'm offline, should we show some kind of notification saying: hey, you can't send messages while you
            // are offline?
        }

        chatJids.push(megaChat.karere.getBareJid());
        $promise = megaChat.openChat(chatJids, chatJids.length == 2 ? "private" : "group");

        if($promise) {
            $promise.done(function(roomJid, room) {
                room.show();
            });
        }


        $('.fm-chat-block').removeClass('hidden');

        $('.message-textarea').unbind('keyup.autoresize');
        $('.message-textarea').bind('keyup.autoresize',function() {
            megaChat.resized();
        });

        $('.fm-chat-emotions-icon').unbind('click.megaChat');
        $('.fm-chat-emotions-icon').bind('click.megaChat', function()
        {
            if ($(this).attr('class').indexOf('active') == -1)
            {
                $(this).addClass('active');
                $('.fm-chat-emotion-popup').addClass('active').removeClass('hidden');
            }
            else
            {
                $(this).removeClass('active');
                $('.fm-chat-emotion-popup').removeClass('active').addClass('hidden');
            }
        });

        $('.fm-chat-smile').unbind('click.megaChat');
        $('.fm-chat-smile').bind('click.megaChat', function()
        {
            $('.fm-chat-emotions-icon').removeClass('active');
            $('.fm-chat-emotion-popup').removeClass('active');
            var c = $(this).data("text");
            if (c)
            {
                c = c.replace('fm-chat-smile ','');
                $('.message-textarea').val($('.message-textarea').val() + c);
                setTimeout(function()
                {
                    moveCursortoToEnd($('.message-textarea')[0]);
                },1);
            }
        });


        //TODO: does not work... fixme
        $('.fm-chat-block').off('mouseover.megachat click.megachat', '.fm-chat-file-button.save-button');
        $('.fm-chat-block').on('mouseover.megachat click.megachat', '.fm-chat-file-button.save-button', function() {
            var currentRoom = megaChat.getCurrentRoom();

            var $chatDownloadPopup = $('.fm-chat-download-popup',currentRoom.$messages);

            var $button = $(this);
            var $attachmentContainer = $button.parents('.attachments-container');
            var message = currentRoom.getMessageById($attachmentContainer.attr('data-message-id'));

            var attachments = message.getMeta().attachments; //alias
            assert(attachments, "no attachments found..something went wrong.")
            var nodeIds = Object.keys(attachments);

            var accessibleNodeIds = [];
            $.each(nodeIds, function(k, v) {
                if(M.d[v]) {
                    accessibleNodeIds.push(v);
                }
            });

            $('.to-cloud', $chatDownloadPopup).unbind('click.megachat');
            $('.as-zip', $chatDownloadPopup).unbind('click.megachat');
            $('.to-computer', $chatDownloadPopup).unbind('click.megachat');

            if(accessibleNodeIds.length > 0) {
                $('.save-button', $attachmentContainer).removeClass('disabled');

                $('.to-cloud', $chatDownloadPopup).bind('click.megachat', function() {
                    $.selected = clone(nodeIds);
                    $.mctype = 'copy-cloud';
                    mcDialog();
                });

                $('.as-zip', $chatDownloadPopup).bind('click.megachat', function() {
                    M.addDownload(nodeIds, true);
                });

                $('.to-computer', $chatDownloadPopup).bind('click.megachat', function() {
                    M.addDownload(nodeIds, false);
                });
            } else {
                $('.save-button', $attachmentContainer).addClass('disabled');
                return;
            }


            var p = $(this);
            var positionY = $(this).closest('.jspPane').outerHeight() - $(this).position().top;
            var positionX = $(this).position().left;
            if (positionY - 174 > 0)
            {
                $($chatDownloadPopup).css('bottom', positionY - 174 + 'px');
                $($chatDownloadPopup).removeClass('top');
            }
            else
            {
                $($chatDownloadPopup).css('bottom', positionY + 'px');
                $($chatDownloadPopup).addClass('top');
            }
            $($chatDownloadPopup).css('left', positionX + $(this).outerWidth()/2 + 10 + 'px');
            $(this).addClass('active');
            $($chatDownloadPopup).removeClass('hidden');


        });



        //TODO: does not work... fixme
        $('.fm-chat-message-scroll').unbind('click');
        $('.fm-chat-message-scroll').bind('click', function()
        {
            $('.fm-chat-download-popup').addClass('hidden');
        });


        //XX: does not work... fix this when we go into v2
        $('.fm-add-user').unbind('click.megaChat');
        $('.fm-add-user').bind('click.megaChat', function()
        {
            // This was causing a bug for the "Add contact" popup (in the #fm/contacts) because that button have the
            // same .fm-add-user class names

            var positionX = $(this).position().left;
            var addUserPopup = $('.fm-add-contact-popup');
            if ($(this).attr('class').indexOf('active') == -1) {                $(addUserPopup).removeClass('hidden');
                $(this).addClass('active');
                $(addUserPopup).css('left', positionX -8 + 'px');
            }
        });



        var typingTimeout = null;
        var stoppedTyping = function() {
            if(typingTimeout) {
                clearTimeout(typingTimeout);

                var room = megaChat.getCurrentRoom();
                if(room && room.state == MegaChatRoom.STATE.READY) {
                    megaChat.karere.sendComposingPaused(megaChat.getCurrentRoomJid());
                }
                typingTimeout = null;
            }
        };

        $('.message-textarea').unbind('keyup.send');
        $('.message-textarea').bind('keyup.send', function(e) {
            if($(this).val().length > 0) {
                if(!typingTimeout) {
                    var room = megaChat.getCurrentRoom();
                    if(room && room.state == MegaChatRoom.STATE.READY) {
                        megaChat.karere.sendIsComposing(megaChat.getCurrentRoomJid());
                    }
                } else if(typingTimeout) {
                    clearTimeout(typingTimeout);
                }

                typingTimeout = setTimeout(function() {
                    stoppedTyping();
                }, 2000);
            } else if($(this).val().length === 0) {
                stoppedTyping();
            }
        });
        $('.message-textarea').unbind('keydown.send');
        $('.message-textarea').bind('keydown.send',function(e) {
            var key = e.keyCode || e.which;


            if(key == 13 && e.shiftKey !== true) {
                var msg = $(this).val();
                if(msg.trim().length > 0) {
                    megaChat.sendMessage(
                        megaChat.getCurrentRoomJid(),
                        msg
                    );
                    $(this).val('');

                    stoppedTyping();

                    megaChat.resized();
                    return false;
                }
            }
        });
        $('.message-textarea').unbind('blur.stoppedcomposing');
        $('.message-textarea').bind('blur.stoppedcomposing',function(e) {
            stoppedTyping();
        });



    }
})();


/**
 * Used to differentiate MegaChat instances running in the same env (tab/window)
 *
 * @type {number}
 */
var megaChatInstanceId = 0;

/**
 * MegaChat - UI component that links XMPP/Strophejs (via Karere) w/ the Mega's UI
 *
 * @returns {MegaChat}
 * @constructor
 */
var MegaChat = function() {
    var self = this;


    this.is_initialized = false;

    this.chats = {};
    this.currentlyOpenedChat = null;
    this._myPresence = localStorage.megaChatPresence;

    this.options = {
        'delaySendMessageIfRoomNotAvailableTimeout': 3000,
        'xmppDomain': "sandbox.developers.mega.co.nz",
        'rtcSession': {
            encryptMessageForJid: function(msg, bareJid) {
                var contact = megaChat.getContactFromJid(bareJid);
                if (!u_pubkeys[contact.h]) {
                    throw new Error("pubkey not loaded: " + contact);
                }
                return base64urlencode(crypto_rsaencrypt(msg, u_pubkeys[contact.h]));
            },
            decryptMessage: function(msg) {
                var decryptedVal = crypto_rsadecrypt(base64urldecode(msg), u_privk);
                if(decryptedVal && decryptedVal.length > 0) {
                    return decryptedVal.substring(0, 44)
                } else {
                    return decryptedVal; // some null/falsy value
                }

            },
            prepareToSendMessage: function(sendMsgFunc, bareJid) {
                api_cachepubkeys({
                    cachepubkeyscomplete : sendMsgFunc
                }, [megaChat.getContactFromJid(bareJid).h]);
            },
            generateMac: function(msg, key) {
                var rawkey = key;
                try {
                    rawkey = atob(key);
                } catch(e) {
//                    if(e instanceof InvalidCharacterError) {
//                        rawkey = key
//                    }
                }
                return asmCrypto.HMAC_SHA256.base64( rawkey, msg );
            },
            iceServers:[
//                 {url: 'stun:stun.l.google.com:19302'},
                {
                    url: 'turn:j100.server.lu:3478?transport=udp',
                    username: "alex",
                    credential: 'alexsecret'
                },
                {
                    url: 'turn:j100.server.lu:3478?transport=tcp',
                    username: "alex",
                    credential: 'alexsecret'
                }
            ]
        },
        filePickerOptions: {
            //TODO: does not work... fixme
            'buttonElement': '.fm-chat-attach-file'
        },
        /**
         * Really simple plugin architecture
         */
        'plugins': {
            'urlFilter': UrlFilter,
            'emoticonsFilter': EmoticonsFilter,
            'attachmentsFilter': AttachmentsFilter
        }
    };

    this.instanceId = megaChatInstanceId++;

    this.plugins = {};


    this.karere = new Karere({
        'clientName': 'mc'
    });

    self.filePicker = null; // initialized on a later stage when the DOM is fully available.

    self.incomingCallDialog = new MegaIncomingCallDialog();

    return this;
};

makeObservable(MegaChat);

/**
 * Initialize the MegaChat (also will connect to the XMPP)
 */
MegaChat.prototype.init = function() {
    var self = this;

    // really simple plugin architecture that will initialize all plugins into self.options.plugins[name] = instance
    self.plugins = {};



    // since this plugin act as filter, it should be added first. (only if in the real app!)
    if(typeof(mocha) == "undefined") {
        self.plugins['encryptionFilter'] = new EncryptionFilter(self);
    }

    $.each(self.options.plugins, function(k, v) {
        self.plugins[k] = new v(self);
    });

    if(!self.filePicker) {
        self.filePicker = new MegaFilePicker(self.options.filePickerOptions);
        self.filePicker.bind('doneSelecting', function(e, selection) {
            if(selection.length == 0) {
                return;
            }

            var room = self.getCurrentRoom();
            if(room) {
                room.attachNodes(
                    selection
                );
            }
        })
    }

    // Karere Events
    this.karere.bind("onPresence", function(e, eventObject) {
        if(eventObject.error) {
            return;
        }

        var bareJid = eventObject.getFromJid().split("/")[0];

        if(eventObject.getShow() != "unavailable") {
            if(eventObject.isMyOwn(self.karere) === false) {

                // update M.u
                var contact = self.getContactFromJid(eventObject.getFromJid());
                if(contact) {
                    if(!contact.presenceMtime || parseFloat(contact.presenceMtime) < eventObject.getDelay()) {
                        contact.presence = eventObject.getShow();
                        contact.presenceMtime = eventObject.getDelay();
                    }
                }

                $.each(self.chats, function(roomJid, room) {
                    if(room.participantExistsInRoom(bareJid) && !self.karere.userExistsInChat(roomJid, eventObject.getFromJid())) {
                        if(localStorage.d) {
                            console.debug(self.karere.getNickname(), "Auto inviting: ", eventObject.getFromJid(), "to: ", roomJid);
                        }

                        self.karere.addUserToChat(roomJid, eventObject.getFromJid(), undefined, room.type, {
                            'ctime': room.ctime,
                            'invitationType': 'resume',
                            'participants': room.users,
                            'users': self.karere.getUsersInChat(roomJid)
                        });

                        return false; // break;
                    }
                });

                // Sync presence across devices (will check the delayed val!)
                if(bareJid == self.karere.getBareJid()) {
                    if(eventObject.getDelay() && eventObject.getDelay() >= parseFloat(localStorage.megaChatPresenceMtime) && self._myPresence != eventObject.getShow()) {
                        self._myPresence = eventObject.getShow();
                        localStorage.megaChatPresence = eventObject.getShow();
                        localStorage.megaChatPresenceMtime = eventObject.getDelay();

                        self.karere.setPresence(
                            eventObject.getShow(),
                            undefined,
                            eventObject.getDelay()
                        );
                    }
                }

            }
        }

        // should we trigger refreshUI ?
        if(eventObject.isMyOwn(self.karere) === false) {
            $.each(self.chats, function(roomJid, room) {

                if(room.participantExistsInRoom(bareJid)) {
                    // if this user is part of the currently visible room, then refresh the UI
                    if(self.getCurrentRoomJid() == room.roomJid) {
                        room.refreshUI();
                    }
                }
            });
        }

        self.renderMyStatus();
        self.renderContactTree();
    });

    // Disco capabilities updated
    this.karere.bind("onDiscoCapabilities", function(e, eventObject) {
        var $treeElement = $('.nw-conversations-item[data-jid="' + eventObject.getFromUserBareJid() + '"]');

        $.each(eventObject.getCapabilities(), function(capability, capable) {
            if(capable) {
                $treeElement.addClass('chat-capability-' + capability);
            } else {
                $treeElement.removeClass('chat-capability-' + capability);
            }
        })
    });

    // Invite messages
    this.karere.bind("onInviteMessage", function(e, eventObject) {
        if(eventObject.isMyOwn(self.karere) === true) {
            e.stopPropagation();
            return false;
        }
        if(localStorage.d) {
            console.debug(self.karere.getNickname(), "Got invitation to join", eventObject.getRoomJid(), "with eventData:", eventObject);
        }


        var meta = eventObject.getMeta();

        if(meta && meta.type == "private") {

            var bareFromJid = eventObject.getFromJid().split("/")[0];
            $.each(self.chats, function(roomJid, room) {
                if(roomJid == eventObject.getRoomJid()) {
                    return; // continue
                }

                if(room.type == "private" && room.participantExistsInRoom(bareFromJid)) {
                    if(localStorage.d) {
                        console.debug(self.karere.getNickname(), "Possible invitation duplicate: ", eventObject.getRoomJid(), roomJid, "with eventData:", eventObject);
                    }

                    if(self.currentlyOpenedChat == room.roomJid) {
                        room.ctime = meta.ctime;
                        room.syncUsers(meta.participants);
                    }

                    // if not already in
                    if(room.state < MegaChatRoom.STATE.JOINING) {
                        room.setState(MegaChatRoom.STATE.JOINING);
                        self.karere.joinChat(eventObject.getRoomJid(), eventObject.getPassword());
                    }

                    e.stopPropagation();
                    return false;
                }
            });

            if(e.isPropagationStopped()) {
                return false;
            }
        }
        if(self.chats[eventObject.getRoomJid()]) { //already joined
            if(localStorage.d) {
                console.warn("I'm already in", eventObject.getRoomJid(), "(ignoring invitation from: ", eventObject.getFromJid(), ")");
            }

            e.stopPropagation();
            return false; // stop doing anything
        }

        // if we are here..then join the room
        if(localStorage.d) {
            console.debug("Initializing UI for new room: ", eventObject.getRoomJid(), "");
        }
        self.chats[eventObject.getRoomJid()] = new MegaChatRoom(self, eventObject.getRoomJid());
        self.chats[eventObject.getRoomJid()].setType(meta.type);
        self.chats[eventObject.getRoomJid()].ctime = meta.ctime;
        self.chats[eventObject.getRoomJid()].setUsers(meta.participants);

        self.chats[eventObject.getRoomJid()].setState(MegaChatRoom.STATE.JOINING);
        self.karere.joinChat(eventObject.getRoomJid(), eventObject.getPassword());


        self.chats[eventObject.getRoomJid()].refreshUI();


        e.stopPropagation();

        return false; // stop propagation, we are manually handling the join on invite case
    });

    var updateMyConnectionStatus = function() {
        self.renderMyStatus();
        self.renderContactTree()
    };


    /**
     * Go throught all megaChat.chats[] and run .startChat so that the user will resume any started conversations,
     * in case of his connection was interuptted
     */
    var recoverChats = function() {
        $.each(self.chats, function(k, v) {
            if(v.state == MegaChatRoom.STATE.INITIALIZED) {
                v.recover();
            }
        });
    };

    this.karere.bind("onConnected", function() {

        if(localStorage.megaChatPresence) {
            self.karere.setPresence(localStorage.megaChatPresence, undefined, localStorage.megaChatPresenceMtime);
        } else {
            self.karere.setPresence();
        }

        updateMyConnectionStatus();

        recoverChats();
    });
    this.karere.bind("onConnecting", updateMyConnectionStatus);
    this.karere.bind("onConnfail", updateMyConnectionStatus);
    this.karere.bind("onAuthfail", updateMyConnectionStatus);
    this.karere.bind("onDisconnecting", updateMyConnectionStatus);
    this.karere.bind("onDisconnected", function() {
        updateMyConnectionStatus();

        $.each(self.chats, function(k, v) {
            v.setState(MegaChatRoom.STATE.INITIALIZED, true);
        })
    });

    this.karere.bind("onUsersJoined", function(e, eventData) {
        return self._onUsersUpdate("joined", e, eventData);
    });

    this.karere.bind("onUsersLeft", function(e, eventData) {
        return self._onUsersUpdate("left", e, eventData);
    });
    this.karere.bind("onUsersUpdatedDone", function(e, eventObject) {
        if(self.chats[eventObject.getRoomJid()] && self.chats[eventObject.getRoomJid()].state == MegaChatRoom.STATE.JOINING) {
            self.chats[eventObject.getRoomJid()].setState(
                MegaChatRoom.STATE.JOINED
            );
        }
    });


    this.karere.bind("onChatMessage", function() {
        self._onChatMessage.apply(self, toArray(arguments));
    });

    this.karere.bind("onActionMessage", function(e, eventObject) {
        if(eventObject.isMyOwn(self.karere) === true || e.isPropagationStopped() === true) {
            return;
        }

        var room;
        var meta = eventObject.getMeta();

        if(eventObject.getAction() == "sync") {
            room = self.chats[meta.roomJid];
            room.sendMessagesSyncResponse(eventObject);
        } else if(eventObject.getAction() == "syncResponse") {
            room = self.chats[meta.roomJid];
            room.handleSyncResponse(eventObject);
        }
    });


    this.karere.bind("onComposingMessage", function(e, eventObject) {
        if(Karere.getNormalizedFullJid(eventObject.getFromJid()) == self.karere.getJid()) {
            return;
        }

        var room = self.chats[eventObject.getRoomJid()];
        if(room) {
            var $element = $('.typing-template', room.$messages);

            var contactHashFromJid = self.getContactFromJid(eventObject.getFromJid());

            if(avatars[contactHashFromJid.u]) {
                $('img', $element).attr(
                    'src',
                    avatars[contactHashFromJid.u].url
                );
            }

            // move to the end of the messages
            $element.insertAfter($('.fm-chat-message-container:last', room.$messages));

            $element
                .removeClass("hidden")
                .removeClass("right-block");

            if(contactHashFromJid.u != u_handle) {
                $element.addClass("right-block");
            }

            $element.addClass("typing");



            room.refreshScrollUI();
            room.resized(true);

        }
    });

    this.karere.bind("onPausedMessage", function(e, eventObject) {
        if(Karere.getNormalizedFullJid(eventObject.getFromJid()) == self.karere.getJid()) {
            return;
        }

        var room = self.chats[eventObject.getRoomJid()];

        if(room) {
            var $element = $('.typing-template', room.$messages);
            $('img', $element).attr("src", "images/mega/default-small-avatar.png");
            $element.addClass("hidden").removeClass("typing");
            room.refreshUI(true);
        }
    });

    // UI events
    $(document.body).undelegate('.top-user-status-item', 'mousedown.megachat');

    $(document.body).delegate('.top-user-status-item', 'mousedown.megachat', function() {
        var presence = $(this).data("presence");
        self._myPresence = presence;

        localStorage.megaChatPresence = presence;
        localStorage.megaChatPresenceMtime = unixtime();

        $('.top-user-status-popup').removeClass("active");

        if(self.karere.getConnectionState() != Karere.CONNECTION_STATE.CONNECTED && presence != Karere.PRESENCE.OFFLINE) {
            self.connect().done(function() {
                self.karere.setPresence(presence, undefined, localStorage.megaChatPresenceMtime);
            });
            return true;
        } else {
            if(presence == Karere.PRESENCE.OFFLINE) {
                self.karere.resetConnectionRetries();
                self.karere.disconnect();
            } else {
                self.karere.resetConnectionRetries();
                self.karere.setPresence(presence, undefined, localStorage.megaChatPresenceMtime);
            }
        }
    });

    $(window).unbind('hashchange.megaChat');
    var lastOpenedRoom = null;
    $(window).bind('hashchange.megaChat' + this.instanceId, function() {
        var room = self.getCurrentRoom();

        if(room && !room.$messages.is(":visible") && room.roomJid != lastOpenedRoom) { // opened window, different then one from the chat ones
            room.hide();
            self.currentlyOpenedChat = null;
        }
        if(lastOpenedRoom && (!room || room.roomJid != lastOpenedRoom)) { // have opened a chat window before, but now
            // navigated away from it
            if(self.chats[lastOpenedRoom]) {
                self.chats[lastOpenedRoom].hide();
            }
        }
        if(lastOpenedRoom && $('.fm-chat-block').is(".hidden")) { // have opened a chat window before, but now
            // navigated away from it
            if(self.chats[lastOpenedRoom]) {
                self.chats[lastOpenedRoom].hide();
                lastOpenedRoom = null;
            }
        }

        if(room) {
            lastOpenedRoom = room.roomJid;
        } else {
            lastOpenedRoom = null;
        }
    });

    self.$container = $('.fm-chat-block');
    self.$header_tpl = $('.fm-right-header', self.$container).clone().removeClass("template");
    assert(self.$header_tpl.length > 0, "Header template not found.");

    self.$messages_tpl = $('.fm-chat-message-scroll', self.$container).clone().removeClass("template");
    assert(self.$messages_tpl.length > 0, "Messages template not found.");

    self.$message_tpl = $('.message.template', self.$container).clone();
    assert(self.$message_tpl.length > 0, "Message template not found.");

    self.$message_tpl
        .removeClass("template")
        .removeClass("message")
        .removeClass("hidden");

    self.$inline_dialog_tpl = $('.fm-chat-messages-block.inline-dialog.template', self.$container).clone();
    assert(self.$inline_dialog_tpl.length > 0, "Inline dialog template not found.");

    self.$inline_dialog_tpl
        .removeClass("template")
        .removeClass("message")
        .removeClass("hidden");


    // cleanup dom nodes that were used as templates
    $('.fm-right-header', self.$container).remove();
    $('.fm-chat-message-scroll', self.$container).remove();
    $('.fm-chat-messages-block.message.template', self.$container).remove();
    $('.fm-chat-messages-block.inline-dialog.template', self.$container).remove();

    if(self.is_initialized) {
        self.destroy()
            .always(function() {
                self.init();
            });

        return;
    }
    self.is_initialized = true;

    $('.activity-status-block, .activity-status').show();

    if(!localStorage.megaChatPresence || localStorage.megaChatPresence != "unavailable") {
        self.connect()
            .always(function() {
                self.renderMyStatus();
            });
    } else {
        self.renderMyStatus();
    }

    try {
        self.rtc = self.karere.connection.rtc = new RtcSession(self.karere.connection, self.options.rtcSession);

        // bind rtc events
        var rtcEventProxyToRoom = function(e, eventData) {
            if(localStorage.d) {
                console.debug("RTC: ", e, eventData);
            }

            var peer = eventData.peer;

            if(peer) {
                var fromBareJid = Karere.getNormalizedBareJid(peer);
                if(fromBareJid == self.karere.getBareJid()) {
                    console.warn("Ignoring my own incoming request.");

                    return;
                }
                var $promise = self.openChat([fromBareJid], "private");

                $promise.done(function(roomJid, room) {
                    room.trigger(e, eventData);
                });
            } else {
                // local-stream-obtained = most likely this is the currently active window/room
                var room = self.getCurrentRoom();
                if(room) {
                    room.trigger(e, eventData);
                }
            }


            // TODO: Multi group calls?
        };

        $(self.rtc).on('call-incoming-request', rtcEventProxyToRoom);
        $(self.rtc).on('call-answered', rtcEventProxyToRoom);
        $(self.rtc).on('call-declined', rtcEventProxyToRoom);
        $(self.rtc).on('call-answer-timeout', rtcEventProxyToRoom);
        $(self.rtc).on('call-canceled', rtcEventProxyToRoom);
        $(self.rtc).on('media-recv', rtcEventProxyToRoom);
        $(self.rtc).on('local-stream-obtained', rtcEventProxyToRoom);
        $(self.rtc).on('remote-player-remove', rtcEventProxyToRoom);
        $(self.rtc).on('local-player-remove', rtcEventProxyToRoom);
        $(self.rtc).on('local-media-fail', rtcEventProxyToRoom);
        $(self.rtc).on('call-init', rtcEventProxyToRoom);
        $(self.rtc).on('call-ended', rtcEventProxyToRoom);
        $(self.rtc).on('muted', rtcEventProxyToRoom);
        $(self.rtc).on('unmuted', rtcEventProxyToRoom);

    } catch(e) {
        // no RTC support.
        console.error("No rtc support: ", e);
    }

    if(self.karere.getConnectionState() == Karere.CONNECTION_STATE.DISCONNECTED) {
        self.karere.authSetup(
            self.getJidFromNodeId(u_handle),
            self.getMyXMPPPassword()
        );
    }
};

/**
 * Connect to the XMPP
 *
 * @returns {Deferred}
 */
MegaChat.prototype.connect = function() {
    var self = this;

    // connection flow already started/in progress?
    if(self.karere.getConnectionState() == Karere.CONNECTION_STATE.CONNECTING) {
        return self.karere._$connectingPromise.always(function() {
            self.renderMyStatus();
        });
    }

    self.karere.resetConnectionRetries();

    return self.karere.connect(
                self.getJidFromNodeId(u_handle),
                self.getMyXMPPPassword()
            )
            .always(function() {
                self.renderMyStatus();
            });
};


/**
 * Incoming chat message handler
 *
 * @param e
 * @param eventObject {KarereEventObjects.IncomingMessage}
 * @private
 */
MegaChat.prototype._onChatMessage = function(e, eventObject) {
    var self = this;

    if(e.isPropagationStopped()) {
        return;
    }
    if(localStorage.d) {
        console.error("MegaChat is now processing incoming message: ", eventObject);
    }

    // ignore empty messages (except attachments)
    if(eventObject.isEmptyMessage() && !eventObject.getMeta().attachments) {
        return;
    }

    var room = self.chats[eventObject.getRoomJid()];
    if(room) {
        room.appendMessage(eventObject);
    } else {
        if(localStorage.d) {
            console.debug("Room not found: ", eventObject.getRoomJid());
        }
    }
};


/**
 * Incoming Users Update handler
 *
 * @param type
 * @param e
 * @param eventData
 * @private
 */
MegaChat.prototype._onUsersUpdate = function(type, e, eventObject) {
    var self = this;
    var updatedJids = Object.keys(eventObject.getCurrentUsers());

    var diffUsers = Object.keys(eventObject[type == "joined" ? "getNewUsers" : "getLeftUsers"]());

    if(type == "joined") {
        $.each(diffUsers, function(k, v) {
            updatedJids.push(v);
        })
    } else {
        $.each(diffUsers, function(k, v) {
            var idx = $.inArray(v, updatedJids);
            delete updatedJids[idx];
        });
    }


    // i had joined OR left
    if($.inArray(self.karere.getJid(), diffUsers) != -1) {
        if(type != "joined") { // i'd left
            // i'd left, remove the room and the UI stuff
            if(self.chats[eventObject.getRoomJid()]) {
                self.chats[eventObject.getRoomJid()].destroy();
            }
        } else { // i'd joined

        }
    } else { //some one else had joined/left the room
        if(type != "joined") { // they left the room
            //XX: If this is a private room and the only user left count == 1, then destroy the room (an UI elements)

            // this code should trigger timeout immediately if there is a request pending for a user who had left the
            // room
            if(self._syncRequests) {
                $.each(self._syncRequests, function(k, v) {
                    if(v.userJid == diffUsers[0]) {
                        console.log("Canceling sync request from ", v.userJid, ", because he had just left the room.");
                        v.timeoutHandler();
                        clearTimeout(v.timer);
                        return false; // break;
                    }
                })
            }
        } else { // they had joined

        }
        var room = self.chats[eventObject.getRoomJid()];
        assert(room, "Room not found!");

        room.syncUsers(clone(updatedJids));
        room.refreshUI();
    }
    //TODO: group chats?
};


/**
 * Destroy this MegaChat instance (leave all rooms then disconnect)
 *
 * @returns {*}
 */
MegaChat.prototype.destroy = function() {
    var self = this;
    localStorage.megaChatPresence = Karere.PRESENCE.OFFLINE;
    localStorage.megaChatPresenceMtime = unixtime();

    if(self.filePicker) {
        self.filePicker.destroy();
        self.filePicker = null;
    }


    $.each(self.chats, function(roomJid, room) {
        room.destroy();
        delete self.chats[roomJid];
    });

    self.karere.resetConnectionRetries();

    return self.karere.disconnect()
        .done(function() {
            self.karere = new Karere({
                'clientName': 'mc'
            });

            self.is_initialized = false;
        });
};

/**
 * Get ALL contacts from the Mega Contacts list
 *
 * @returns {Array}
 */
MegaChat.prototype.getContacts = function() {
    var results = [];
    $.each(M.u, function(k, v) {
        if(v.c == 1 || v.c == 2) {
            results.push(v);
        }
    });
    return results;
};

/**
 * Get Contact object from the Mega's Contacts that corresponds to the given jid
 *
 * @param jid {String} full or bare jid...does not mather
 * @returns {Object|null}
 */
MegaChat.prototype.getContactFromJid = function(jid) {
    var self = this;


    assert(jid, "Missing jid");

    jid = Karere.getNormalizedBareJid(jid); // always convert to bare jid

    var contact = null;
    $.each(M.u, function(k, v) {
        if((v.c == 1 || v.c == 2) && self.getJidFromNodeId(k) == jid) {
            contact = v;
            return false; // break;
        }
    });
    if(!contact) {
        // this can happen if:
        // user A added user B
        // user B's contacts list is still not updated
        // user B receives a XMPP presence info that user A is online and tries to render a DOM element which requires
        // the user's name..so this method gets called.
        if(localStorage.d) {
            //debugger;
        }
    }
    return contact;
};

/**
 * Get formatted contact name from Jid
 *
 * @param jid {String} full/bare jid, does not matter
 * @returns {String|undefined}
 * @throws {AssertionError}
 */
MegaChat.prototype.getContactNameFromJid = function(jid) {
    var self = this;
    var contact = self.getContactFromJid(jid);

    /* XXX: THIS WONT work in group chats, where all users are not contacts w/ each other, so we will show the jid@ part */

    var name = jid.split("@")[0];


    if(contact && contact.name) {
        name = contact.name;
    } else if(contact && contact.m) {
        name = contact.m;
    }

    assert(name, "Name not found for jid: " + jid);

    return name;
};


/**
 * Helper to convert XMPP presence from string (e.g. 'chat'), to a CSS class (e.g. will return 'online')
 *
 * @param presence {String}
 * @returns {String}
 */
MegaChat.prototype.xmppPresenceToCssClass = function(presence) {
    if(presence == Karere.PRESENCE.ONLINE || presence == Karere.PRESENCE.AVAILABLE || presence === true) {
        return 'online';
    } else if(presence == Karere.PRESENCE.AWAY || presence == "xa") {
        return 'away';
    } else if(presence == Karere.PRESENCE.BUSY) {
        return 'busy';
    } else if(!presence || presence == Karere.PRESENCE.OFFLINE) {
        return 'offline';
    } else {
        return 'black';
    }
};

/**
 * Used to re-render my own presence/status
 */
MegaChat.prototype.renderMyStatus = function() {
    var self = this;

    // reset
    var $status = $('.activity-status-block .activity-status');

    $('.top-user-status-popup .top-user-status-item').removeClass("active");


    $status
        .removeClass('online')
        .removeClass('away')
        .removeClass('busy')
        .removeClass('offline')
        .removeClass('black');



    var presence = self.karere.getConnectionState() == Karere.CONNECTION_STATE.CONNECTED ?
                self.karere.getPresence(self.karere.getJid()) :
                localStorage.megaChatPresence;

    var cssClass = self.xmppPresenceToCssClass(
        presence
    );


    if(!presence && self.karere.getConnectionState() == Karere.CONNECTION_STATE.CONNECTED) {
        if(!localStorage.megaChatPresence) {
            presence = localStorage.megaChatPresence = "chat"; // default
        } else { // cached
            presence = localStorage.megaChatPresence;
        }

    } else if(self.karere.getConnectionState() == Karere.CONNECTION_STATE.DISCONNECTED || self.karere.getConnectionState() == Karere.CONNECTION_STATE.DISCONNECTING) {
        cssClass = "offline";
    }



    if(cssClass == 'online') {
        $('.top-user-status-popup .top-user-status-item[data-presence="chat"]').addClass("active");
    } else if(cssClass == 'away') {
        $('.top-user-status-popup .top-user-status-item[data-presence="away"]').addClass("active");
    } else if(cssClass == 'busy') {
        $('.top-user-status-popup .top-user-status-item[data-presence="dnd"]').addClass("active");
    } else if(cssClass == 'offline') {
        $('.top-user-status-popup .top-user-status-item[data-presence="unavailable"]').addClass("active");
    } else {
        $('.top-user-status-popup .top-user-status-item[data-presence="unavailable"]').addClass("active");
    }

    $status.addClass(
        cssClass
    );

    if(self.karere.getConnectionState() == Karere.CONNECTION_STATE.CONNECTING) {
        $status.parent()
            .addClass("connecting");
    } else {
        $status.parent()
            .removeClass("connecting");
    }

};


/**
 * Used to pre/render my contacts statuses + unread counts (in the Tree panel)
 */
MegaChat.prototype.renderContactTree = function() {
    var self = this;
    $.each(self.getContacts(), function(k, contact) {
        var $element = $('.content-panel > #contact_' + contact.u + ', .content-panel.conversations #contact2_' + contact.u);
        // skip if element does not exists
        if($element.size() == 0) {
            return;
        }

        $element.removeClass("online");
        $element.removeClass("offline");
        $element.removeClass("busy");
        $element.removeClass("away");
        $element.removeClass("no");

        var presence = self.karere.getPresence(self.getJidFromNodeId(contact.u));

        if(!presence || presence == Karere.PRESENCE.OFFLINE) {
            $element.addClass("offline");
        } else if(presence == Karere.PRESENCE.AWAY) {
            $element.addClass("away");
        } else if(presence == Karere.PRESENCE.BUSY) {
            $element.addClass("busy");
        } else if(presence === true || presence == Karere.PRESENCE.ONLINE || presence == Karere.PRESENCE.AVAILABLE) {
            $element.addClass("online");
        } else {
            $element.addClass("offline");
        }


        assert(
            $element.size() == 2,
            'nav elements not found (expected 2, got: ' + $element.size() + ')'
        );

        var $conversationNavElement;
        if($($element[1]).is('.nw-conversations-item')) {
            $conversationNavElement = $($element[1]);
        } else if($($element[0]).is('.nw-conversations-item')) {
            $conversationNavElement = $($element[0]);
        } else {
            assert(false, 'none of the elments is .nw-conversation-item');
        }

        $conversationNavElement.attr("data-jid", self.getJidFromNodeId(contact.u));

        if(contact.u != u_handle) {
            $conversationNavElement.unbind("click.megaChat");
            $conversationNavElement.bind("click.megaChat", function() {
                window.location = "#fm/chat/" + contact.u;
            });

            var room = self.chats[
                $conversationNavElement.attr('data-room-jid') + "@" + self.karere.options.mucDomain
                ];
            if(room) {
                room.renderContactTree();
            }
        }
    });
};

/**
 * Reorders the contact tree by last activity (THIS is going to just move DOM nodes, it will NOT recreate them from
 * scratch, the main goal is to be fast and clever.)
 */
MegaChat.prototype.reorderContactTree = function() {
    var self = this;

    var folders = M.getContacts({
        'h': 'contacts'
    });

    folders = M.sortContacts(folders);

    //TODO: this should use the new HTML code, not #treesub_contacts
    var $container = $('#treesub_contacts');

    var $prevNode = null;
    $.each(folders, function(k, v) {
        var $currentNode = $('#treeli_' + v.u);

        if(!$prevNode) {
            var $first = $('li:first:not(#treeli_' + v.u + ')', $container);
            if($first.size() > 0) {
                $currentNode.insertBefore($first);
            } else {
                $container.append($currentNode)
            }
        } else {
            $currentNode.insertAfter($prevNode);
        }


        $prevNode = $currentNode;
    });
};


/**
 * This function is an abstract placeholder that should return JID from a nodeID (e.g. Mega User IDs)
 *
 * @param nodeId {String}
 * @returns {string}
 */
MegaChat.prototype.getJidFromNodeId = function(nodeId) {
    assert(nodeId, "Missing nodeId for getJidFromNodeId");

    return megaUserIdEncodeForXmpp(nodeId) + "@" + this.options.xmppDomain;
};

/**
 * Placeholder function that should return my password for authenticating w/ the XMPP server
 *
 * @returns {String}
 */
MegaChat.prototype.getMyXMPPPassword = function() {
    return u_sid ? u_sid.substr(0, 16) : false;
};


/**
 * Open (and show) a new chat
 *
 * @param jids {Array} list of bare jids
 * @param type {String} "private" or "group"
 * @returns {Deferred}
 */
MegaChat.prototype.openChat = function(jids, type) {
    var self = this;
    type = type || "private";

    var $promise = new $.Deferred();

    if(type == "private") {
        var $element = $('.nw-conversations-item[data-jid="' + jids[0] + '"]');
        var roomJid = $element.attr('data-room-jid') + "@" + self.karere.options.mucDomain;
        if(self.chats[roomJid]) {
//            self.chats[roomJid].show();
            $promise.resolve(roomJid, self.chats[roomJid]);
            return $promise;
        } else {
            // open new chat
        }
    }


    var roomJid;
    if(type == "private") {
        roomJid = self.generatePrivateRoomName(jids);
    } else {
        roomJid = self._generateNewRoomIdx();
    }

    if(self.currentlyOpenedChat && self.currentlyOpenedChat != roomJid) {
        self.hideChat(self.currentlyOpenedChat);
        self.currentlyOpenedChat = null;
    }


    var room = new MegaChatRoom(self, roomJid + "@" + self.karere.options.mucDomain);
    room.setType(type);
    room.setUsers(jids);
    room.ctime = unixtime();
    if(!self.currentlyOpenedChat) {
        room.show();
    }

    self.chats[room.roomJid] = room;

    var tmpJid = room.roomJid;

//    $promise.done(function(roomJid, room) {
//        assert(roomJid, "missing room jid");

        if(self.currentlyOpenedChat === tmpJid) {
            self.currentlyOpenedChat = roomJid;
            if(room) {
                room.show();
            }
        } else {
            if(room) {
                room.refreshUI();
            }
        }
//    });



    if(self.karere.getConnectionState() != Karere.CONNECTION_STATE.CONNECTED) {
        return;
    }

    var jidsWithoutMyself = room.getParticipantsExceptMe(jids);

    room.setState(MegaChatRoom.STATE.JOINING);

    var $startChatPromise = self.karere.startChat([], type, roomJid, (type == "private" ? false : undefined));

    $startChatPromise
        .done(function(roomJid) {
            $.each(jidsWithoutMyself, function(k, userJid) {

                if(self.chats[roomJid]) {
                    self.karere.addUserToChat(roomJid, userJid, undefined, type, {
                        'ctime': self.chats[roomJid].ctime,
                        'invitationType': "created",
                        'participants': jids,
                        'users': self.karere.getUsersInChat(roomJid)
                    });
                }
            });

            $promise.resolve(roomJid, self.chats[roomJid]);
        })
        .fail(function() {
            $promise.reject.apply($promise, toArray(arguments))
            if(self.chats[$startChatPromise.roomJid]) {
                self.chats[$startChatPromise.roomJid].destroy();
            }
        });




    return $promise;
};


/**
 * Used to generate unique room JID for private (1on1) chats.
 *
 * @param jids {Array} of BARE jids
 * @returns {string}
 */
MegaChat.prototype.generatePrivateRoomName = function(jids) {
    var self = this;
    var newJids = clone(jids);
    newJids.sort();
    var roomName = "prv";
    $.each(newJids, function(k, jid) {
        roomName = roomName + "_" + fastHashFunction(jid.split("@")[0]);
    });

    return roomName;
};

/**
 * Returns the currently opened room/chat
 *
 * @returns {null|undefined|Object}
 */
MegaChat.prototype.getCurrentRoom = function() {
    return this.chats[this.currentlyOpenedChat];
};

/**
 * Returns the currently opened room/chat JID
 *
 * @returns {null|String}
 */
MegaChat.prototype.getCurrentRoomJid = function() {
    return this.currentlyOpenedChat;
};


/**
 * Hide a room/chat's UI components.
 *
 * @param roomJid
 */
MegaChat.prototype.hideChat = function(roomJid) {
    var self = this;

    var room = self.chats[roomJid];
    if(room) {
        room.hide();
    } else {
        if(localStorage.d) {
            console.warn("Room not found: ", roomJid);
        }
    }
};


/**
 * Send message to a specific room
 *
 * @param roomJid
 * @param val
 */
MegaChat.prototype.sendMessage = function(roomJid, val) {
    var self = this;

    // queue if room is not ready.
    if(!self.chats[roomJid]) {
        if(localStorage.d) {
            console.warn("Queueing message for room: ", roomJid, val);
        }

        createTimeoutPromise(function() {
            return !!self.chats[roomJid]
        }, 100, self.options.delaySendMessageIfRoomNotAvailableTimeout)
            .done(function() {
                self.chats[roomJid].sendMessage(val);
            });
    } else {
        self.chats[roomJid].sendMessage(val);
    }
};

/**
 * Simple function that takes care to reposition some elements, when the window is resized
 */
MegaChat.prototype.resized = function() {
    var self = this;
    var room = self.getCurrentRoom();
    if(room) {
        room.resized();
    }
};


/**
 * Generates a room JID for a private chat with `jid`
 * @param jid {string} this should be a bare jid (however, it will get normalized in case you pass a full jid)
 * @returns {*|jQuery}
 */
MegaChat.prototype.getPrivateRoomJidFor = function(jid) {
    jid = Karere.getNormalizedBareJid(jid);
    var roomJid = $('.nw-conversations-item[data-jid="' + jid + '"]').attr("data-room-jid");

    assert(roomJid, "Missing private room jid for user jid: " + jid);
    return roomJid;
};



/**
 * Called when a new user is added into MEGA
 *
 * @param u {Object} object containing user information (u.u is required)
 */
MegaChat.prototype.processNewUser = function(u) {
    var self = this;

    if(localStorage.d) { console.error("added: ", u); }


    this.karere.subscribe(megaChat.getJidFromNodeId(u));

    self.renderContactTree();
    self.renderMyStatus();
};

/**
 * Called when a new contact is removed into MEGA
 *
 * @param u {Object} object containing user information (u.u is required)
 */
MegaChat.prototype.processRemovedUser = function(u) {
    var self = this;

    if(localStorage.d) { console.error("removed: ", u); }


    this.karere.unsubscribe(megaChat.getJidFromNodeId(u));

    self.renderContactTree();
    self.renderMyStatus();
};


/**
 * Refresh the currently active conversation list in the UI
 */
MegaChat.prototype.refreshConversations = function() {
    var self = this;

    // remove any dom elements for rooms which were destroyed
    $('.content-panel .conversations .nw-conversations-item').each(function() {
        if($(this).data('chatRoomId') && !self.chats[$(this).data('chatRoomId')]) {
            $(this).remove();
        }
    });

    //XX: move the current code from mega.js to here?

//    $.each(self.chats, function(k, v) {
//        if($('.content-panel .conversations .nw-conversations-item[data-chatRoomId="' + k + '"]').size() == 0) {
//            // does not exists, create new dom element
//            var $elem = $('<div class="nw-conversations-item"><div class="nw-contact-status"></div><div class="nw-conversations-name"></div></div>');
//
//            var participants = v.getParticipantsExceptMe();
//
//            $elem.data('chatRoomJid', k);
//
//            if(v.type == "private") {
//                $elem.addClass("private_" + self.getContactFromJid(participants[0]).u);
//            }
//
//            var contactName = self.getContactNameFromJid(participants[0]);
//            $('.nw-conversations-name', $elem).text(contactName);
//
//            $('.content-panel.conversations').append($elem);
//        }
//    });

    self.renderContactTree();
};

MegaChat.prototype.closeChatPopups = function() {
    var activePopup = $('.chat-popup.active');
    var activeButton = $('.chat-button.active');
    activeButton.removeClass('active');
    activePopup.removeClass('active');
    if (activePopup.attr('class')) {
        activeButton.removeClass('active');
        activePopup.removeClass('active');
        if (activePopup.attr('class').indexOf('fm-add-contact-popup') == -1) activePopup.css('left', '-' + 10000 + 'px');
        else activePopup.css('right', '-' + 10000 + 'px');
    }
};


/**
 * Debug helper
 */

MegaChat.prototype.getChatNum = function(idx) {
    return this.chats[Object.keys(this.chats)[idx]];
};

/**
 * Class used to represent a MUC Room in which the current user is present
 *
 * @param megaChat {MegaChat}
 * @param roomJid
 * @returns {MegaChatRoom}
 * @constructor
 */
var MegaChatRoom = function(megaChat, roomJid) {
    this.megaChat = megaChat;
    this.users = [];
    this.hash = null;
    this.roomJid = roomJid;
    this.type = null;
    this.messages = [];
    this.messagesIndex = {};

    this.callRequest = null;
    this.callIsActive = false;

    this.options = {
        /**
         * Maximum time for waiting a message sync, before trying to send a request to someone else in the room or
         * failing the SYNC operation at all (if there are no other users to query for the sync op).
         */
        'requestMessagesSyncTimeout': 2500,

        /**
         * Send any queued messages if the room is not READY
         */
        'sendMessageQueueIfNotReadyTimeout': 6500, // XX: why is this so slow? optimise please.

        /**
         * Change the state of the room to READY in case there was no response in timely manner. (e.g. there were no
         * users who responded for a sync call).
         */
        'messageSyncFailAfterTimeout': 10000, // XX: why is this so slow? optimise please.

        /**
         * Used to cleanup the memory from sent sync requests.
         * This should be high enough, so that it will be enough for a response to be generated (message log to be
         * encrypted), send and received.
         */
        'syncRequestCleanupTimeout': 15000,

        /**
         * The maximum time allowed for plugins to set the state of the room to PLUGINS_READY
         */
        'pluginsReadyTimeout': 30000,

        /**
         * Default media options
         */
        'mediaOptions': {
            audio: true,
            video: true
        }
    };
    this._syncRequests = {};
    this._messagesQueue = [];

    this.lastActivity = [];

    this.setState(MegaChatRoom.STATE.INITIALIZED);

    this.$messages = megaChat.$messages_tpl.clone();
    this.$header = megaChat.$header_tpl.clone();

    var droppableConfig = {
        tolerance: 'pointer',
        drop: function(e, ui)
        {
            $.doDD(e,ui,'drop',1);
        },
        over: function (e, ui)
        {
            $.doDD(e,ui,'over',1);
        },
        out: function (e, ui)
        {
            var c1 = $(e.srcElement).attr('class'),c2 = $(e.target).attr('class');
            if (c2 && c2.indexOf('fm-menu-item') > -1 && c1 && (c1.indexOf('cloud') > -1 || c1.indexOf('cloud') > -1)) return false;
            $.doDD(e,ui,'out',1);
        }
    };

    this.$messages.droppable(droppableConfig);
    this.$header.droppable(droppableConfig);

    // Events
    var self = this;
    this.bind('onStateChange', function(e, oldState, newState) {
        if(localStorage.d) {
            console.error("Will change state from: ", MegaChatRoom.stateToText(oldState), " to ", MegaChatRoom.stateToText(newState));
        }
        var resetStateToReady = function() {
            if(self.state != MegaChatRoom.STATE.LEFT && self.state != MegaChatRoom.STATE.READY) {
                if(localStorage.d) {
                    console.warn("setting state to READY.");
                }
                self.setState(MegaChatRoom.STATE.READY);
            }
        };

        if(newState == MegaChatRoom.STATE.PLUGINS_READY) {
            resetStateToReady();
        } else if(newState == MegaChatRoom.STATE.JOINED) {
            self.setState(MegaChatRoom.STATE.PLUGINS_WAIT);

        } else if(newState == MegaChatRoom.STATE.PLUGINS_WAIT) {
            var $event = new $.Event("onPluginsWait");
            self.megaChat.trigger($event, [self]);

            if(!$event.isPropagationStopped()) {
                self.setState(MegaChatRoom.STATE.PLUGINS_READY);
            }
        } else if(newState == MegaChatRoom.STATE.PLUGINS_PAUSED) {
            // allow plugins to hold the PLUGINS_WAIT state for MAX 5s
            createTimeoutPromise(function() {
                return self.state !== MegaChatRoom.STATE.PLUGINS_PAUSED && self.state !== MegaChatRoom.STATE.PLUGINS_WAIT
            }, 100, self.options.pluginsReadyTimeout)
                .fail(function() {
                    if(self.state == MegaChatRoom.STATE.PLUGINS_WAIT || self.state == MegaChatRoom.STATE.PLUGINS_PAUSED) {
                        if(localStorage.d) {
                            console.error("Plugins had timed out, setting state to PLUGINS_READY");
                        }

                        self.setState(MegaChatRoom.STATE.PLUGINS_READY);
                    }
                });
        } else if(newState == MegaChatRoom.STATE.READY) {
            if(self.encryptionHandler.state === mpenc.handler.STATE.INITIALISED) {
                self._flushMessagesQueue();
            }
        }
    });

    this.$header.hide();
    this.$messages.hide();

    this.$header.insertBefore(
        $('.fm-chat-line-block', this.megaChat.$container)
    );

    this.$messages.insertBefore(
        $('.fm-chat-line-block', this.megaChat.$container)
    );


    this.$messages.jScrollPane({enableKeyboardNavigation:false,showArrows:true, arrowSize:5, animateDuration: 70});



    // button triggered popups
    // - start-call
    $('.chat-button > span', self.$header).unbind("click.megaChat");

    $('.chat-button.fm-start-call', self.$header).bind("click.megaChat", function() {
        var positionX = $(this).position().left;
        var sendFilesPopup = $('.fm-start-call-popup', self.$header);
        if ($(this).attr('class').indexOf('active') == -1) {
            self.megaChat.closeChatPopups();
            sendFilesPopup.addClass('active');
            $(this).addClass('active');
            $('.fm-start-call-arrow', self.$header).css('left', $(this).outerWidth()/2  + 'px');
            sendFilesPopup.css('left',  $(this).position().left + 'px');
        } else {
            self.megaChat.closeChatPopups();

        }
    });
    // - send-files
    $('.chat-button.fm-send-files', self.$header).unbind('click.megaChat');
    $('.chat-button.fm-send-files', self.$header).bind('click', function()
    {
        var positionX = $(this).position().left;
        var manuallyAddedOffset = 60; // since this is the last button, i had to add this offset so that it wont go out
                                      // of the screen
        var sendFilesPopup = $('.fm-send-files-popup', self.$header);
        if ($(this).attr('class').indexOf('active') == -1)
        {
            self.megaChat.closeChatPopups();
            sendFilesPopup.addClass('active');
            $(this).addClass('active');
            $('.fm-send-files-arrow', self.$header).css('left', $(this).outerWidth()/2 + manuallyAddedOffset  + 'px');
            sendFilesPopup.css('left',  ($(this).position().left - manuallyAddedOffset) + 'px');
        }
        else
        {
            self.megaChat.closeChatPopups();

        }
    });

    /**
     * Audio/Video button handlers
     */
    $('.call-actions', self.$header).unbind('click.megaChat');

    var startCall = function() {
        self.megaChat.closeChatPopups();

        var participants = self.getParticipantsExceptMe();
        assert(participants.length > 0, "No participants.");

        var doCancel = function() {
            if(self.callRequest && self.callRequest.cancel) {
                self.callRequest.cancel();

                resetCallStateNoCall();
            }
            self.megaChat.karere.connection.rtc.hangup();
        };

        if(self.callRequest) {
            doCancel();
        }
        self.callRequest = self.megaChat.rtc.startMediaCall(participants[0], self.getMediaOptions());

        $('.btn-chat-cancel-active-call', self.$header).bind('click.megaChat', function() {
            doCancel();
        });


        resetCallStateInCall();

        self.appendDomMessage(
            self.generateInlineDialog(
                "outgoing-call",
                "Calling " + self.megaChat.getContactNameFromJid(participants[0]) + "...",
                undefined,
                ['fm-chat-call-started'], {
                    'reject': {
                        'type': 'secondary',
                        'text': "Cancel",
                        'callback': doCancel
                    }
                }
            )
        );
    };
    $('.start-audio', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.audio = true;
        self.options.mediaOptions.video = false;

        startCall();
    });
    $('.start-video', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.audio = true;
        self.options.mediaOptions.video = true;

        startCall();
    });


    $('.btn-chat-mute', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.audio = false;
        self.megaChat.karere.connection.rtc.muteUnmute(true, {audio:true});

        resetCallStateInCall();
    });
    $('.btn-chat-unmute', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.audio = true;
        self.megaChat.karere.connection.rtc.muteUnmute(false, {audio:true});

        resetCallStateInCall();
    });

    $('.btn-chat-video-mute', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.video = false;
        self.megaChat.karere.connection.rtc.muteUnmute(true, {video:true});

        resetCallStateInCall();
    });
    $('.btn-chat-video-unmute', self.$header).bind('click.megaChat', function() {
        self.options.mediaOptions.video = true;
        self.megaChat.karere.connection.rtc.muteUnmute(false, {video:true});



        resetCallStateInCall();
    });

    self.bind('call-incoming-request', function(e, eventData) {
        $('.call-actions', self.$header).hide();

        var doAnswer = function() {
            self.megaChat.incomingCallDialog.hide();

            eventData.answer(true, {
                mediaOptions: self.getMediaOptions()
            });

            if(self.megaChat.getCurrentRoomJid() != self.roomJid) {
                self.activateWindow();
            }

            resetCallStateInCall();
        };

        var doCancel = function() {
            self.megaChat.incomingCallDialog.hide();

            eventData.answer(false, {reason:'busy'});

            self.trigger('call-declined', eventData);
        };

        var participants = self.getParticipantsExceptMe();

        if(self.type == "private") {

            assert(participants[0], "No participants found.");


            var contact = self.megaChat.getContactFromJid(participants[0]);

            if(!contact) {
                console.warn("Contact not found: ", participants[0]);
            } else {

                var avatar = undefined;
                if(avatars[contact.u]) {
                    avatar = avatars[contact.u].url;
                }

                self.megaChat.incomingCallDialog.show(
                    self.megaChat.getContactNameFromJid(participants[0]),
                    avatar,
                    function() {
                        self.options.mediaOptions.audio = true;
                        self.options.mediaOptions.video = false;

                        doAnswer();
                    },
                    function() {
                        self.options.mediaOptions.audio = true;
                        self.options.mediaOptions.video = true;

                        doAnswer();
                    },
                    function() {
                        doCancel();
                    }
                );
            }

        } else {
            throw new Error("Not implemented"); //TODO: Groups, TBD
        }



        var $answer = $('.btn-chat-answer-incoming-call', self.$header);
        $answer.unbind('click.megaChat');
        $answer.bind('click.megaChat', doAnswer);
        $answer.show();

        var $cancel = $('.btn-chat-reject-incoming-call', self.$header);
        $cancel.unbind('click.megaChat');
        $cancel.bind('click.megaChat', doCancel);
        $cancel.show();

        self.appendDomMessage(
            self.generateInlineDialog(
                "incoming-call",
                "Incoming Call from " + self.megaChat.getContactNameFromJid(eventData.peer),
                undefined,
                ['fm-chat-call-started'],
                {
                    'answer': {
                        'type': 'primary',
                        'text': "Answer",
                        'callback': doAnswer
                    },
                    'reject': {
                        'type': 'secondary',
                        'text': "Cancel",
                        'callback': doCancel
                    }
                }
            )
        );
    });

    var callStartedState = function(e, eventData) {
        $('.call-actions', self.$header).hide();

        var $cancel = $('.btn-chat-cancel-active-call', self.$header);
        $cancel.unbind('click.megaChat');
        $cancel.bind('click.megaChat', function() {
            self.megaChat.karere.connection.rtc.hangup(); /** pass eventData.peer? **/
        });
        $cancel.show();

        resetCallStateInCall();
    };

    var resetCallStateNoCall = function() {
        self.callIsActive = false;

        self.megaChat.incomingCallDialog.hide();

        $('.call-actions', self.$header).hide();
        $('.btn-chat-call', self.$header).show();

        self.getInlineDialogInstance("incoming-call").remove();
        self.getInlineDialogInstance("outgoing-call").remove();

        self.refreshScrollUI();

        self.refreshUI();
    };
    var resetCallStateInCall = function() {
        self.callIsActive = true;

        $('.call-actions', self.$header).hide();
        if(!self.options.mediaOptions.audio) {
            $('.btn-chat-unmute', self.$header).show();
        } else {
            $('.btn-chat-mute', self.$header).show();
        }

        if(!self.options.mediaOptions.video) {
            $('.btn-chat-video-unmute', self.$header).show();

            $('.local-video-container', self.$header).addClass("muted");

        } else {
            $('.btn-chat-video-mute', self.$header).show();

            $('.local-video-container', self.$header).removeClass("muted");

        }

        $('.btn-chat-cancel-active-call', self.$header).show();

        self.getInlineDialogInstance("incoming-call").remove();
        self.getInlineDialogInstance("outgoing-call").remove();

        self.refreshScrollUI();

        self.refreshUI();
    };

    self.bind('call-init', function(e, eventData) {
        self.appendDomMessage(
            self.generateInlineDialog(
                "started-call-" + unixtime(),
                "Call with " + self.megaChat.getContactNameFromJid(eventData.peer) + " started.",
                undefined,
                ['fm-chat-call-started']
            )
        );
        callStartedState(e, eventData);
    });
    self.bind('call-answered', function(e, eventData) {
        self.appendDomMessage(
            self.generateInlineDialog(
                "started-call-" + unixtime(),
                "Call with " + self.megaChat.getContactNameFromJid(eventData.peer) + " started.",
                undefined,
                ['fm-chat-call-started'])
        );

        callStartedState(e, eventData);
    });

    self.bind('call-answer-timeout', function(e, eventData) {
        self.appendDomMessage(
            self.generateInlineDialog(
                "rejected-call-" + unixtime(),
                "Incoming Call from " + self.megaChat.getContactNameFromJid(eventData.peer) + " was not answered in a timely manner.",
                undefined,
                ['fm-chat-missed-call']
            )
        );
        resetCallStateNoCall();
    });
    self.bind('call-declined', function(e, eventData) {
        var msg;
        var peer = eventData.peer;
        if(Strophe.getBareJidFromJid(peer) == self.megaChat.karere.getBareJid()) {
            msg = "Incoming Call with " + self.megaChat.getContactNameFromJid(self.getParticipantsExceptMe()[0]) + " was rejected.";
        }  else {
            msg = "Incoming Call with " + self.megaChat.getContactNameFromJid(peer) + " was rejected.";
        }


        self.appendDomMessage(
            self.generateInlineDialog(
                "rejected-call-" + unixtime(),
                msg,
                undefined,
                ['fm-chat-rejected-call']
            )
        );

        resetCallStateNoCall();
    });

    self.bind('call-canceled', function(e, eventData) {
        if(eventData.info && eventData.info.event == "handled-elsewhere") {
            self.appendDomMessage(
                self.generateInlineDialog(
                    "canceled-call-" + unixtime(),
                    "Incoming Call from " + self.megaChat.getContactNameFromJid(eventData.from) + " was handled on some other device.",
                    undefined,
                    ['fm-chat-different-device-call']
                )
            );
        } else {
            self.appendDomMessage(
                self.generateInlineDialog(
                    "canceled-call-" + unixtime(),
                    "Incoming Call from " + self.megaChat.getContactNameFromJid(eventData.from) + " was canceled.",
                    undefined,
                    ['fm-chat-rejected-call']
                )
            );
        }
        resetCallStateNoCall();
    });

    self.bind('call-ended', function(e, eventData) {
        var msg = "Call with " + self.megaChat.getContactNameFromJid(eventData.peer) + " ended.";

        if(eventData.reason == "security") {
            self.appendDomMessage(
                self.generateInlineDialog(
                    "error-" + unixtime(),
                    msg + " " + eventData.text,
                    undefined,
                    ['fm-chat-call-ended']
                )
            )
        } else {
            self.appendDomMessage(
                self.generateInlineDialog(
                    "ended-call-" + unixtime(),
                    msg,
                    undefined,
                    ['fm-chat-call-ended']
                )
            );
        }


        resetCallStateNoCall();
    });

    self.bind('media-recv', function(event, obj) {
        $('.remote-video-container', self.$header).append(obj.player);
        resetCallStateInCall();
    });
    self.bind('local-stream-obtained', function(event, obj) {
        $('.local-video-container', self.$header).append(obj.player);
    });

    self.bind('local-player-remove', function(event, obj) {
        $(obj.player).remove();
    });

    self.bind('remote-player-remove', function(event, obj) {
        $(obj.id).remove();
    });

    self.bind('muted', function(e, eventData) {
        //TODO: Impl.
    });
    self.bind('unmuted', function(e, eventData) {
        //TODO: Impl.
    });



    // activity on a specific room (show, hidden, got new message, etc)
    self.bind('activity', function(e) {
        self.lastActivity = unixtime();

        if(self.type == "private") {
            var targetUserJid = self.getParticipantsExceptMe()[0];
            var targetUserNode = self.megaChat.getContactFromJid(targetUserJid);
            assert(M.u, 'M.u does not exists');
            assert(targetUserNode && targetUserNode.u, 'No hash found for participant');
            assert(M.u[targetUserNode.u], 'User not found in M.u');

            if(targetUserNode) {
                M.u[targetUserNode.u].lastChatActivity = self.lastActivity;
            }
        } else {
            throw new Error("Not implemented");
        }

        if(M.csort == "chat-activity") {
            // Trigger manual reorder, if M.renderContacts() is called it will remove some important .opened classes
            self.megaChat.reorderContactTree();
        }


//        if(M.csort == "chat-activity") {
//            M.renderContacts();
//        };
    });

    self.megaChat.trigger('onRoomCreated', [self]);
    return this;
};

/**
 * Add support for .on, .bind, .unbind, etc
 */
makeObservable(MegaChatRoom);

/**
 * Room states
 *
 * @type {{INITIALIZED: number, JOINING: number, JOINED: number, PLUGINS_WAIT: number, PLUGINS_READY: number, READY: number, LEAVING: number, LEFT: number}}
 */
MegaChatRoom.STATE = {
    'INITIALIZED': 5,
    'JOINING': 10,
    'JOINED': 20,

    'PLUGINS_WAIT': 30,
    'PLUGINS_READY': 40,


    'READY': 150,

    'PLUGINS_PAUSED': 175,

    'LEAVING': 200,

    'LEFT': 250
};

/**
 * Convert state to text (helper function)
 *
 * @param state {Number}
 * @returns {String}
 */
MegaChatRoom.stateToText = function(state) {
    var txt = null;
    $.each(MegaChatRoom.STATE, function(k, v) {
        if(state == v) {
            txt = k;

            return false; // break
        }
    });

    return txt;
};

/**
 * Change the state of this room
 *
 * @param newState {MegaChatRoom.STATE.*} the new state
 * @param [isRecover] {Boolean}
 */
MegaChatRoom.prototype.setState = function(newState, isRecover) {
    var self = this;

    assert(newState, 'Missing state');

    if(newState == self.state) {
        if(localStorage.d) {
            console.log("Ignoring .setState, newState == oldState, current state: ", self.getStateAsText());
        }
        return;
    }

    if(self.state) { // if not == null, e.g. setting to INITIALIZED
        // only allow state changes to be increasing the .state value (5->10->....150...) with the exception when a
        // PLUGINS_PAUSED is the current or new state
        assert(
            newState === MegaChatRoom.STATE.PLUGINS_PAUSED ||
                self.state === MegaChatRoom.STATE.PLUGINS_PAUSED ||
                (newState === MegaChatRoom.STATE.JOINING && isRecover) ||
                (newState === MegaChatRoom.STATE.INITIALIZED && isRecover) ||
                newState > self.state,
            'Invalid state change. Current:' + MegaChatRoom.stateToText(self.state) +  "to" + MegaChatRoom.stateToText(newState)
        );
    }

    var oldState = self.state;
    self.state = newState;

    self.trigger('onStateChange', [oldState, newState]);
};

/**
 * Returns current state as text
 *
 * @returns {String}
 */
MegaChatRoom.prototype.getStateAsText = function() {
    var self = this;
    return MegaChatRoom.stateToText(self.state);
};

/**
 * Change/set the type of the room
 *
 * @param type
 */
MegaChatRoom.prototype.setType = function(type) {
    var self = this;

    if(!type) {
        if(localStorage.d) {
            debugger;
        }
    }

    self.type = type;
};

/**
 * Set the users (participants) of the room.
 * This is different then the actual current room occupants, based on the XMPP info, because it should contain a list
 * of BARE jids which SHOULD be in the room.
 *
 * Note: All of those JIDs would get auto-invitations to join this room when they connect to the XMPP automatically.
 *
 * @param jids {Array} List of bare jids
 */
MegaChatRoom.prototype.setUsers = function(jids) {
    this.users = clone(jids);

    this.refreshUI();
};


/**
 * the same as .setUsers, w/ the difference that it will only add any of the user jids in `jids` to the `.users`,
 * instead of just overwriting the `.users` property
 *
 * @param jids {Array} List of bare jids
 */
MegaChatRoom.prototype.syncUsers = function(jids) {
    var self = this;

    assert(jids, "Missing jids");

    var users = clone(self.users);

    $.each(jids, function(k, v) {
        if(v) {
            v = v.split("/")[0];
            if(self.users.indexOf(v) == -1) {
                users.push(
                    v
                )
            }
        }
    });

    if(users.length > self.users.length) {
        self.setUsers(users);
    }
};

/**
 * Check if participant exists in room
 *
 * @param jid {String} Full OR Bare jid
 * @param strict {boolean} If true, will only check for FULL jids.
 * @returns {boolean}
 */
MegaChatRoom.prototype.participantExistsInRoom = function(jid, strict) {
    var self = this;

    strict = strict || false;

    var result = false;
    $.each(self.users, function(k, v) {
        if(!v) {
            if(localStorage.d) {
                debugger;
            }
            return;
        }
        if(strict && v == jid) {
            result = true;
            return false; // break;
        } else if(!strict && v.split("/")[0] == jid) {
            result = true;
            return false; // break;
        }
    });

    return result;
};


/**
 * Get all participants in a chat room.
 *
 * @returns {Array}
 */
MegaChatRoom.prototype.getParticipants = function() {
    var self = this;

    var participants = {};


    $.each(self.users, function(k, v) {
        if(!v) {
            if(localStorage.d) {
                debugger;
            }
            return;
        }
        participants[v.split("/")[0]] = true;
    });

    return Object.keys(participants);
};

/**
 * Get all users in the chat room.
 *
 * @returns {Array}
 */
MegaChatRoom.prototype.getUsers = function() {
    var self = this;

    return self.megaChat.karere.getUsersInChat(self.roomJid);
};

/**
 * Get all users in the chat room ordered by joining time.
 *
 * @returns {Array}
 */
MegaChatRoom.prototype.getOrderedUsers = function() {
    var self = this;

    return self.megaChat.karere.getOrderedUsersInChat(self.roomJid);
};

/**
 * Get room owner (e.g. the oldest user who joined and is currently in the room)
 *
 * @returns {(string|null)}
 */
MegaChatRoom.prototype.getRoomOwner = function() {
    var self = this;

    var users = self.megaChat.karere.getOrderedUsersInChat(self.roomJid);

    return users[0];
};

MegaChatRoom.prototype.getParticipantsExceptMe = function(jids) {
    var self = this;
    if(!jids) {
        jids = self.getParticipants();
    }
    var jidsWithoutMyself = clone(jids);
    jidsWithoutMyself.splice($.inArray(self.megaChat.karere.getBareJid(), jidsWithoutMyself), 1);

    return jidsWithoutMyself;
};

/**
 * Refreshes the UI of the chat room.
 *
 * @param [scrollToBottom] boolean set to true if you want to automatically scroll the messages pane to the bottom
 */
MegaChatRoom.prototype.refreshUI = function(scrollToBottom) {
    var self = this;

    this.$header.attr("data-room-jid", this.roomJid.split("@")[0]);

    var $jsp = self.$messages.data("jsp");
    assert($jsp, "JSP not available?!");

    $jsp.reinitialise();

    if(scrollToBottom) {
        self.$messages.one('jsp-initialised', function() {
            $jsp.scrollToBottom();
        });
    }

    $('.fm-chat-user', this.$header).text(this.roomJid.split("@")[0]);

    var participants = self.getParticipantsExceptMe();

    if(self.type == "private") {
        $.each(self.users, function(k, v) {
            if(v == self.megaChat.karere.getBareJid()) {
                // ignore me
                return; // continue;
            }
            var $element = $('.nw-conversations-item[data-jid="' + v + '"]');
            $element.attr("data-room-jid", self.roomJid.split("@")[0]);
            console.warn(self.roomJid, v, $element);
        });
    }

    if(self.type == "private") {

        assert(participants[0], "No participants found.");

        $('.fm-chat-user', self.$header).text(
            self.megaChat.getContactNameFromJid(participants[0])
        );
        var contact = self.megaChat.getContactFromJid(participants[0]);

        if(!contact) {
            console.warn("Contact not found: ", participants[0]);
        } else {
            var presence = self.megaChat.karere.getPresence(
                self.megaChat.getJidFromNodeId(contact.u)
            );

            var presenceCssClass = self.megaChat.xmppPresenceToCssClass(
                presence
            );

            $('.fm-chat-user-info', self.$header)
                .removeClass('online')
                .removeClass('away')
                .removeClass('busy')
                .removeClass('offline')
                .removeClass('black')
                .addClass(presenceCssClass);


            if($('#topmenu').children().size() == 0) {
                $('#topmenu').html(parsetopmenu()); // we need the top menu!
            }
            var presenceText = $.trim($('.top-user-status-item > .' + presenceCssClass).parent().text());

            assert(presenceText && presenceText.length > 0, 'missing presence text');

            $('.fm-chat-user-status', self.$header)
                .text(
                    presenceText
                );

            if(avatars[contact.u]) {
                $('.nw-contact-avatar > img', self.$header).attr(
                    'src',
                    avatars[contact.u].url
                );
            }

            // TODO: implement verification logic
            if (contact.verified) {
                $('.nw-contact-avatar', self.$header).addClass('verified');
            }

        }
    } else {
        throw new Error("Not implemented"); //TODO: Groups, TBD
    }


    /**
     * Audio/Video buttons
     */

    if(self.callIsActive === false) {
        $('.call-actions', self.$header).hide();

        if(presenceCssClass == "offline") {
            $('.btn-chat-call', self.$header).hide();
        } else {
            var haveCallCapability = false;
            if(self.megaChat.rtc) { // only check if the CLIENT have the required capabilities (.rtc = initialised)
                $.each(participants, function(k, p) {
                   var capabilities = self.megaChat.karere.getCapabilities(p);

                   if(!capabilities) {
                       return; // continue;
                   }
                   if(capabilities['audio'] || capabilities['video']) {
                       haveCallCapability = true;
                   }
                });
            }

            if(haveCallCapability) {
                $('.btn-chat-call', self.$header).show();
            }
        }
    }

    self.renderContactTree();

    self.megaChat.refreshConversations();
};


/**
 * Leave this chat room
 *
 * @returns {undefined|Deferred}
 */
MegaChatRoom.prototype.leave = function() {
    var self = this;

    if(self.roomJid.indexOf("@") != -1) {
        self.setState(MegaChatRoom.STATE.LEAVING);
        return self.megaChat.karere.leaveChat(self.roomJid).done(function() {
            self.setState(MegaChatRoom.STATE.LEFT);
        });
    } else {
        self.setState(MegaChatRoom.STATE.LEFT);
    }
};

/**
 * Destroy a room (leave + UI destroy + js cleanup)
 */
MegaChatRoom.prototype.destroy = function() {
    var self = this;

    self.megaChat.trigger('onRoomDestroy', [self]);

    // destroy any waiting sync requests
    if(self._syncRequests) {
        $.each(self._syncRequests, function(messageId, req) {

            clearTimeout(req.timer);
        });
        delete self._syncRequests;
    };

    self.leave();

    self.$header.remove();
    self.$messages.remove();

    var $element = $('.nw-conversations-item[data-room-jid="' + self.roomJid.split("@")[0] + '"]');
    $element.removeAttr("data-room-jid");

    delete self.megaChat[self.roomJid];
};


/**
 * Show UI elements of this room
 */
MegaChatRoom.prototype.show = function() {
    var self = this;


    $('.files-grid-view').addClass('hidden');
    $('.fm-blocks-view').addClass('hidden');
    $('.contacts-grid-view').addClass('hidden');
    $('.fm-contacts-blocks-view').addClass('hidden');

    $('.nw-conversations-item').removeClass('selected');

    $('.fm-right-files-block').removeClass('hidden');



    sectionUIopen('conversations');


    self.$header.show();
    self.$messages.show();
    self.$messages.parent().removeClass('hidden'); // show .fm-chat-block if hidden

    if(self.megaChat.currentlyOpenedChat && self.megaChat.currentlyOpenedChat != self.roomJid) {
        var oldRoom = self.megaChat.getCurrentRoom();
        if(oldRoom) {
            oldRoom.hide();
        }
    }

    self.megaChat.currentlyOpenedChat = self.roomJid;

    // update unread messages count
    $('.fm-chat-messages-block.unread', self.$messages).removeClass('unread');
    self.unreadCount = 0;


    self.resized();

    self.trigger('activity');
};


/**
 * If this is not the currently active room, then this method will navigate the user to this room (using window.location)
 */
MegaChatRoom.prototype.activateWindow = function() {
    var self = this;

    if(self.type == "private") {
        var participants = self.getParticipantsExceptMe();
        var contact = self.megaChat.getContactFromJid(participants[0]);
        if(contact) {
            window.location = "#fm/chat/" + contact.u;
        }
    } else {
        throw new Error("Not implemented");
    }
};

/**
 * Hide the UI elements of this room
 */
MegaChatRoom.prototype.hide = function() {
    var self = this;


    self.$header.hide();
    self.$messages.hide();

    if(self.megaChat.currentlyOpenedChat == self.roomJid) {
        self.megaChat.currentlyOpenedChat = null;
    }
};

/**
 * Append message to the UI of this room.
 * Note: This method will also log the message, so that later when someone asks for message sync this log will be used.
 *
 * @param message {KarereEventObjects.IncomingMessage|KarereEventObjects.OutgoingMessage|Object}
 * @returns {boolean}
 */
MegaChatRoom.prototype.appendMessage = function(message) {
    var self = this;

    if(message.getFromJid() == self.roomJid) {
        return; // dont show any system messages (from the conf room)
    }
    if(self.messagesIndex[message.getMessageId()] !== undefined) {
        if(localStorage.d) {
            console.debug(self.roomJid.split("@")[0], message.getMessageId(), "This message is already added to the message list (and displayed).");
        }
        return false;
    }

    self.messagesIndex[message.getMessageId()] = self.messages.push(
        message
    );


    var $message = self.megaChat.$message_tpl.clone().removeClass("template").addClass("fm-chat-message-container");

    var jid = Karere.getNormalizedBareJid(message.getFromJid());


    if(jid != self.megaChat.karere.getBareJid() && self.roomJid != self.megaChat.getCurrentRoomJid()) {
        $message.addClass('unread');
    }

    var timestamp = message.getDelay() ? message.getDelay() : unixtime();

    $('.nw-chat-date-txt', $message).text(
        unixtimeToTimeString(timestamp) //time2last is a too bad performance idea.
    );

    var name = self.megaChat.getContactNameFromJid(jid);

    $('.nw-contact-avatar img', $message).attr(
        'alt',
        name + ", " + unixtimeToTimeString(timestamp)
    );

    var contact = self.megaChat.getContactFromJid(jid);
    if(contact && contact.u && avatars[contact.u]) {
        $('.nw-contact-avatar img', $message).attr(
            'src',
            avatars[contact.u].url
        );
    }

    // add .current-name if this is my own message
    if(jid != self.megaChat.karere.getBareJid()) {
        $('.fm-chat-messages-block', $message).addClass("right-block");
    } 



    $message.attr('data-timestamp', timestamp);
    $message.attr('data-id', message.getMessageId());
    $message.attr('data-from', jid.split("@")[0]);


    if(!message.messageHtml) {
        message.messageHtml = htmlentities(message.getContents()).replace(/\n/gi, "<br/>");
    }

    var event = new $.Event("onReceiveMessage");
    self.megaChat.trigger(event, message);

    if(event.isPropagationStopped()) {
        if(localStorage.d) {
            console.warn("Event propagation stopped receiving (rendering) of message: ", message)
        }
        return false;
    }


    if(message.messageHtml) {
        $('.fm-chat-message span', $message).html(
            message.messageHtml.replace(/\s{2}/gi, "&nbsp;")
        );
    } else {
        $('.fm-chat-message span', $message).html(
            htmlentities(message.getContents()).replace(/\n/gi, "<br/>").replace(/\s/gi, "&nbsp;")
        );
    }



    var event = new $.Event("onBeforeRenderMessage");
    self.megaChat.trigger(event, {
        message: message,
        $message: $message,
        room: self
    });

    if(event.isPropagationStopped()) {
        if(localStorage.d) {
            console.warn("Event propagation stopped receiving (rendering) of message: ", message)
        }
        return false;
    }
    return self.appendDomMessage($message, message);
};


/**
 * Will refresh the room's chat messages scroll pane
 */
MegaChatRoom.prototype.refreshScrollUI = function() {
    var self = this;
    var $jsp = self.$messages.data('jsp');

    assert($jsp, "JSP not available.");
    $jsp.reinitialise();
};

/**
 * Should be used to append messages in the message pane
 *
 * @param $message {*|jQuery} jQuery object containing the DOM Element that should be appended to the messages pane
 * @param messageObject {(KarereEventObjects.IncomingMessage|KarereEventObjects.OutgoingMessage)} contains message data
 */
MegaChatRoom.prototype.appendDomMessage = function($message, messageObject) {
    var self = this;

    var $jsp = self.$messages.data('jsp');

    assert($jsp, "JSP not available.");

    var $before = null;
    var $after = null;

    if(!messageObject) {
        messageObject = {};
    }

    var timestamp = unixtime();

    if(messageObject.getDelay) {
        timestamp = messageObject.getDelay();
    }

    $message.attr('data-timestamp', timestamp);

    $('.jspContainer > .jspPane > .fm-chat-message-container', self.$messages).each(function() {
        if(timestamp >= $(this).attr('data-timestamp')) {
            $after = $(this);
        } else if($before === null && timestamp < $(this).attr('data-timestamp')) {
            $before = $(this);
        }
    });

    if(!$after && !$before) {
//        console.log("append: ", message.message);
        $('.jspContainer > .jspPane', self.$messages)
            .append($message);
    } else if($before) {
//        console.log("before: ", message.message, $before.text());
        $message.insertBefore($before);
    }  else if($after) {
//        console.log("after: ", message.message, $after.text());
        $message.insertAfter($after);
    }

    self._regroupMessages();


    self.resized();

    // update unread messages count
    if(self.roomJid != self.megaChat.getCurrentRoomJid() && $message.is('.unread')) {
        var $navElement = self.getNavElement();
        var $count = $('.nw-conversations-unread', $navElement);

        var count = $('.fm-chat-message-container.unread', self.$messages).size();
        if(count > 0) {
            self.unreadCount = count;
            $navElement.addClass("unread");
        } else if(count === 0) {
            self.unreadCount = 0;
        }
        self.renderContactTree();
    }

    $jsp.reinitialise();
    $jsp.scrollToBottom();

    self.trigger('activity');
};


/**
 * Should take care of messages grouping (UI)
 *
 * @private
 */
MegaChatRoom.prototype._regroupMessages = function() {
    var self = this;
    var $messages = self.$messages;
    // group messages by hidding the author's name
    $('.fm-chat-message-container', $messages).each(function() {
        var $message = $(this);

        var author = $message.data("from");

        var $prevMessage = $message.prevAll('.fm-chat-message-container');
        if(author && $prevMessage.is(".fm-chat-message-container")) {
            if($prevMessage.data("from") == author) {
                $message.addClass('grouped-message');
            } else {
                $message.removeClass('grouped-message');
            }
        }

    });

}

/**
 * Generates a DOM Element containing the required UI elements for an inline dialog (buttons, text message, icon, etc)
 *
 * @param type {string} used internally, if late access to the DOM element of the dialog is required (e.g. to remove it)
 * @param title {string} text that will be used as title
 * @param messageContents {string} text that will be used as message content
 * @param headingCssClasses {Array} array of css class names to be added to the heading (used to append icons with css)
 * @param [buttons] {Array} Array of objects in the format of {type: "primary|seconday", text: "button 1", callback: fn(e)}
 * @param [read] {boolean} set to `true` if you want to mark only this message/dialog as ready (e.g. ignore the unread UI logic)
 * @returns {jQuery|HTMLElement}
 */
MegaChatRoom.prototype.generateInlineDialog = function(type, title, messageContents, headingCssClasses, buttons, read) {
    headingCssClasses = headingCssClasses || [];

    var self = this;

    var $inlineDialog = self.megaChat.$inline_dialog_tpl.clone();

    if(!read && self.roomJid != self.megaChat.getCurrentRoomJid()) {
        $inlineDialog.addClass('unread');
    }

    $inlineDialog.addClass('fm-chat-inline-dialog-' + type);

    var $heading = $('.fm-chat-inline-dialog-header', $inlineDialog);

    $.each(headingCssClasses, function(k, v) {
        $heading.addClass(v);
    });

    $heading.text(title);

    $('.fm-chat-message', $inlineDialog).text(messageContents ? messageContents : "");

    var $pad = $('.fm-chat-messages-pad', $inlineDialog);

    var $primaryButton = $('.verify-button', $inlineDialog).detach();
    var $secondaryButton = $('.skip-button', $inlineDialog).detach();

    if(buttons) {
        $.each(buttons, function(k, v) {
            var $button = v.type == "primary" ? $primaryButton.clone() : $secondaryButton.clone();
            $button.addClass('fm-chat-inline-dialog-button-' + k);
            $button.text(v.text);
            $button.bind('click', function(e) {
                v.callback(e);
            });
            $pad.append($button);
        });
    }

    return $inlineDialog;
};

/**
 * Simple getter to get an inline dialog by `type` from the current message pane
 *
 * @param type {string} whatever type you'd used before when calling `.generateInlineDialog`
 * @returns {*|jQuery|HTMLElement}
 */
MegaChatRoom.prototype.getInlineDialogInstance = function(type) {
    var self = this;

    return $('.fm-chat-inline-dialog-' + type, self.$messages);
};


/**
 * Request a messages sync for this room
 *
 * Note: This is a recursion-like function, which uses the `exceptFromUsers` argument to mark which users had failed to
 * respond with a message sync response.
 *
 * Second note: this function will halt if a request was already executed successfuly. (see this._syncDone)
 *
 * @param exceptFromUsers {Array} Array of FULL JIDs which should be skipped when asking for messages sync (e.g. they
 * had timed out in the past)
 */
MegaChatRoom.prototype.requestMessageSync = function(exceptFromUsers) {
    var self = this;
    var megaChat = self.megaChat;
    var karere = megaChat.karere;

    if(localStorage.d) {
        console.warn("will eventually sync:", self)
    }

    // sync only once
    if(self._syncDone === true) {
        return;
    }
    self._syncDone = true;

    console.warn("sync started:", self)

    exceptFromUsers = exceptFromUsers || [];

    var users = karere.getUsersInChat(self.roomJid);

    // Pick from which user should i ask for sync.

    if(Object.keys(users).length == 1) {
        // empty room
        console.debug("Will not sync room: ", self.roomJid, ", because its empty (no participants).");
        return false;
    }

    var ownUsers = [];
    $.each(users, function(k, v) {
        if(k == karere.getJid()) {
            return; // continue;
        } else if(exceptFromUsers.indexOf(k) != -1) {
            return; //continue
        } else { // only from mine users: if(k.split("/")[0] == karere.getBareJid())
            if(k.split("/")[0] == karere.getBareJid()) {
                ownUsers.push(k);
            }
        }
    });

    if(ownUsers.length === 0) {
        if(localStorage.d) {
            console.error("No users to sync messages from for room: ", self.roomJid, "except list:", exceptFromUsers);
        }
        return false;
    }
    var userNum = Math.floor(Math.random() * ownUsers.length) + 0;
    var userJid = ownUsers[userNum];

    if(localStorage.dd) {
        console.debug("Potential message sync users: ", ownUsers);
    }


    var messageId = karere.sendAction(
        userJid,
        'sync',
        {
            'roomJid': self.roomJid
        }
    );

    if(!self._syncRequests) {
        self._syncRequests = {};
    }

    self._syncRequests[messageId] = {
        'messageId': messageId,
        'userJid': userJid,
        'timeoutHandler': function() {
            console.warn(new Date(), "Sync request timed out from user: ", userJid, " for room: ", self.roomJid);

            delete self._syncRequests[messageId];
            exceptFromUsers.push(userJid);
            self.requestMessageSync(exceptFromUsers);
        },
        'timer': setTimeout(function() {
            // timed out
            if(localStorage.d) {
                console.warn("Timeout waiting for", userJid, "to send sync message action. Will eventually, retry with some of the other users.");
            }

            self._syncRequests[messageId].timeoutHandler();
        }, self.options.requestMessagesSyncTimeout)
    };
    if(localStorage.d) {
        console.warn(new Date(), "Sent a sync request to user: ", userJid, " for room: ", self.roomJid);
    }

    return true;
};

/**
 * Send messages sync response
 *
 * @param request {KarereEventObjects.ActionMessage} with the `meta` from the actual request XMPP message
 * @returns {boolean}
 */
MegaChatRoom.prototype.sendMessagesSyncResponse = function(request) {
    var self = this;
    var megaChat = self.megaChat;
    var karere = megaChat.karere;

    if(!karere.getUsersInChat(self.roomJid)[request.getFromJid()]) {
        if(localStorage.d) {
            console.error("Will not send message sync response to user who is not currently in the chat room for which he requested the sync.")
        }
        return false;
    }

    // Send messages as chunks (easier XML parsing?)

    var messagesCount = self.messages.length;
    var messagesChunkSize = 10;
    for(var i = 0; i < messagesCount; i+=messagesChunkSize) {
        var messages = self.messages.slice(i, i + messagesChunkSize);

        // remove Non-Plain Objects from messages
        $.each(messages, function(k, v) {
            $.each(v, function(prop, val) {
                if(typeof(val) == "object" && !$.isPlainObject(val)) {
                    delete messages[k][prop];
                }
            });
        });


        // cleanup some non-needed data from the messages
        $.each(messages, function(k, v) {
            if(messages[k].messageHtml) {
                delete messages[k].messageHtml;
            }
        });

        karere.sendAction(
            request.getFromJid(),
            'syncResponse',
            {
                'inResponseTo': request.getMessageId(),
                'roomJid': request.getMeta().roomJid,
                'messages': messages,
                'offset': i,
                'chunkSize': messagesChunkSize,
                'total': messagesCount
            }
        );
    }
};

/**
 * This is a handler of message sync responses
 *
 * @param response {KarereEventObjects.ActionMessage} with the `meta` of the message sync response
 * @returns {boolean}
 */
MegaChatRoom.prototype.handleSyncResponse = function(response) {
    var self = this;
    var megaChat = self.megaChat;
    var karere = megaChat.karere;

    var meta = response.getMeta();

    if(!karere.getUsersInChat(self.roomJid)[response.getFromJid()]) {
        if(localStorage.d) {
            console.error("Will not accept message sync response from user who is currently not in the chat room for which I'd requested the sync.")
        }
        return false;
    }
    if(self._syncRequests) {
        if(!self._syncRequests[meta.inResponseTo]) {
            if(localStorage.d) {
                console.warn(
                    "Will not accept message sync response because inResponseTo, did not matched any cached messageIDs, " +
                    "got: ", meta.inResponseTo, ". Most likely they had sent the response too late. Requests " +
                    "currently active:", JSON.stringify(self._syncRequests)
                );
            }
            return false;
        }
        clearTimeout(self._syncRequests[meta.inResponseTo].timer);
    } else {
        if(localStorage.d) {
            console.warn("Invalid sync response, room not found:", response);
        }
        return false;
    }

    // cleanup
    $.each(self._syncRequests, function(messageId, request) {
        clearTimeout(request.timer);
    });

    if(self._syncRequests.cleanupTimeout) {
        clearTimeout(self._syncRequests.cleanupTimeout);
    }
    self._syncRequests.cleanupTimeout = setTimeout(function() {
        delete self._syncRequests;
    }, self.options.syncRequestCleanupTimeout);

    $.each(meta.messages, function(k, msg) {
        // msg is a plain javascript object, since it passed JSON serialization, so now we will convert it to propper
        // {KarereEventObjects.IncomingMessage}
        self.appendMessage(new KarereEventObjects.IncomingMessage(
            self.roomJid,
            msg.fromJid,
            "Message",
            "Message",
            msg.messageId,
            undefined,
            self.roomJid,
            msg.meta,
            msg.contents,
            undefined,
            msg.delay
        ));
    });

    if((meta.chunkSize + meta.offset) >= meta.total) {
        if(localStorage.d) {
            console.warn(new Date(), "finished sync from: ", response.getFromJid(), self.roomJid, meta.total);
        }
    } else {
        if(localStorage.d) {
            console.debug("waiting for more messages from sync: ", meta.total - (meta.chunkSize + meta.offset));
        }
    }

};

/**
 * Returns the actual DOM Element from the Mega's main navigation (tree) that is related to this chat room.
 *
 * @returns {*|jQuery|HTMLElement}
 */
MegaChatRoom.prototype.getNavElement = function() {
    var self = this;

    if(self.type == "private") {
        return $('.nw-conversations-item[data-room-jid="' + self.roomJid.split("@")[0] + '"]');
    } else {
        throw new Error("Not implemented.");
    }
};


/**
 * Will check if any of the plugins requires a message to be 'queued' instead of sent.
 *
 * @param [message] {Object} optional message object (currently not used)
 * @returns {boolean}
 */
MegaChatRoom.prototype.arePluginsForcingMessageQueue = function(message) {
    var self = this;
    var pluginsForceQueue = false;

    $.each(self.megaChat.plugins, function(k) {
        if(self.megaChat.plugins[k].shouldQueueMessage) {
            if(self.megaChat.plugins[k].shouldQueueMessage(self, message) === true) {
                pluginsForceQueue = true;
                return false; // break
            }
        }
    });

    return pluginsForceQueue;
}

/**
 * Send message to this room
 *
 * @param message {String}
 * @param [meta] {Object}
 */
MegaChatRoom.prototype.sendMessage = function(message, meta) {
    var self = this;
    var megaChat = this.megaChat;
    meta = meta || {};


    if(
        megaChat.karere.getConnectionState() !== Karere.CONNECTION_STATE.CONNECTED ||
            self.arePluginsForcingMessageQueue(message) ||
            (self.state != MegaChatRoom.STATE.READY && message.indexOf("?mpENC:") !== 0)
        ) {
        var messageId = megaChat.karere.generateMessageId(self.roomJid);
        var eventObject = new KarereEventObjects.OutgoingMessage(
            self.roomJid,
            megaChat.karere.getJid(),
            "groupchat",
            messageId,
            message,
            meta,
            unixtime()
        );


        var event = new $.Event("onQueueMessage");

        self.megaChat.trigger(event, [
            eventObject,
            self
        ]);

        if(event.isPropagationStopped()) {
            return false;
        }

        if(localStorage.dd) {
            console.debug("Queueing: ", eventObject);
        }

        self._messagesQueue.push(eventObject);

        self.appendMessage(eventObject);
    } else {
        megaChat.karere.sendRawMessage(self.roomJid, "groupchat", message, meta);
    }
};

/**
 * Helper for accessing options.mediaOptions;
 *
 * @returns {*}
 */
MegaChatRoom.prototype.getMediaOptions = function() {
    return this.options.mediaOptions;
};

/**
 * Internal method to notify the server that the specified `nodeids` are sent/shared to `users`
 * @param nodeids
 * @param users
 * @private
 */
MegaChatRoom.prototype._sendNodes = function(nodeids, users) {
    var json = [], apinodes=[];

    var $promise = new $.Deferred();

    for (var i in nodeids)
    {
        var n = M.d[nodeids[i]];
        if (n)
        {
            if (n.t)
            {
                var subnodes = fm_getnodes(nodeids[i]);
                for (var j in subnodes)
                {
                    var n2 = M.d[subnodes[j]];
                    // subnodes retain their parent nodeid to retain the same folder structure
                    if (n2) json.push(M.cloneChatNode(n2,true));
                }
            }
            // root nodes do not retain their parent nodeid, because they become "root nodes" in the chat - access will be granted to these nodes and subnode access can be determined based on parent node access rights

            json.push(M.cloneChatNode(n));
            apinodes.push(n.h);
        }
    }


    // TODO: implement API call to grant access to the root nodes, pass following data in API call:
    // - apinodes
    // - users
    // for now simulate a random API call:

    console.error("sendNodes: ", apinodes, apinodes);

    api_req({a:'uq'},
        {
            callback2: function() {
                $promise.resolve(toArray(arguments));
            },
            failhandler: function() {
                $promise.reject(toArray(arguments));
            },
            json: json,
            callback: function(res,ctx)
            {
                // check if result is all positive  (should be) and fire off callback:
                if (ctx.callback2) ctx.callback2(ctx.json);
            }
        });

    return $promise;
};



/**
 * Attach/share (send as message) file/folder nodes to the chat
 * @param ids
 * @param [message]
 */
MegaChatRoom.prototype.attachNodes = function(ids, message) {
    var self = this;
    message = message || "";

    if(ids.length === 0) {
        return;
    }

    loadingDialog.show();

    var users = [];

    $.each(self.getParticipants(), function(k, v) {
        var contact = self.megaChat.getContactFromJid(v);
        if(contact && contact.u) {
            users.push(
                contact.u
            );
        }
    });

    var $masterPromise = new $.Deferred();

    self._sendNodes(
            ids,
            users
        )
        .done(function(responses) {

            var attachments = {};
            $.each(ids, function(k, nodeId) {
                var node = M.d[nodeId];
                attachments[nodeId] = {
                    'name': node.name,
                    'h': nodeId,
                    's': node.s,
                    't': node.t,
                    'sharedWith': users
                };
            });
            var messageId = self.sendMessage(message, {
                'attachments': attachments
            });
            $masterPromise.resolve(
                messageId,
                attachments,
                message
            );
        })
        .fail(function(r) {
            $masterPromise.reject(r);
        })
        .always(function() {
            loadingDialog.hide();
        });

    return $masterPromise;
};

/**
 * Get message by Id
 * @param messageId {string} message id
 * @returns {boolean}
 */
MegaChatRoom.prototype.getMessageById = function(messageId) {
    var self = this;
    var found = false;
    $.each(self.messages, function(k, v) {
        if(v.messageId == messageId) {
            found = v;
            return false; //break;
        }
    });

    return found;
};

/**
 * Used to update the DOM element containing data about this room.
 * E.g. unread count
 */
MegaChatRoom.prototype.renderContactTree = function() {
    var self = this;

    var $navElement = self.getNavElement();

    var $count = $('.nw-conversations-unread', $navElement);

    var count = self.unreadCount;
    if(count > 0) {
        $count.text(count);
        $navElement.addClass("unread");
    } else if(count === 0) {
        $count.text("");
        $navElement.removeClass("unread");
    }

    $navElement.data('chatroom', self);
};

/**
 * Re-join - safely join a room after connection error/interruption
 */
MegaChatRoom.prototype.recover = function() {
    var self = this;

    if(localStorage.d) {
        console.error('recovering room: ', self.roomJid, self);
    }

    self._syncRequests = [];
    self.callIsActive = false;
    self.callRequest = null;
    self.setState(MegaChatRoom.STATE.JOINING, true);
    var $startChatPromise = self.megaChat.karere.startChat([], self.type, self.roomJid.split("@")[0], (self.type == "private" ? false : undefined));

    self.megaChat.trigger("onRoomCreated", [self]); // re-initialise plugins

    return $startChatPromise;
};

/**
 * Handle UI resize (triggered by the window, document or manually from our code)
 */
MegaChatRoom.prototype.resized = function(scrollToBottom) {
    var self = this;

    var $el = $('.message-textarea');
    $el.height('auto');
    var text = $el.val();
    var lines = text.split("\n");
    var count = lines.length;
    if ($el.val().length != 0 && count>1)
    {
        $el.height($el.prop("scrollHeight"));
        self.refreshUI(true);
    }
    else if ($el.height() > 27)
    {
        $el.height('27px');
    }

    var scrollBlockHeight = $('.fm-chat-block').outerHeight() - $('.fm-chat-line-block').outerHeight() - self.$header.outerHeight();
    if (scrollBlockHeight != self.$messages.outerHeight())
    {
        self.$messages.height(scrollBlockHeight);

        self.refreshUI(scrollToBottom);
    }
};


/**
 * This method will be called on room state change, only when the mpenc's state is === INITIALISED
 *
 * @private
 */
MegaChatRoom.prototype._flushMessagesQueue = function() {
    var self = this;

    if(localStorage.dd) {
        console.log("Chat room state set to ready, will flush queue: ", self._messagesQueue);
    }

    if(self._messagesQueue.length > 0) {
        $.each(self._messagesQueue, function(k, v) {
            if(!v) {
                return; //continue;
            }

            self.megaChat.karere.sendRawMessage(self.roomJid, "groupchat", v.getContents(), v.getMeta(), v.getMessageId(), v.getDelay());
        });
        self._messagesQueue = [];
    }

    self.requestMessageSync();
}
window.megaChat = new MegaChat();