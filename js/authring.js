/**
 * @fileOverview
 * Storage of authenticated contacts.
 */

var u_authring = { 'Ed25519': undefined,
                   'RSA': undefined };

var authring = (function () {
    "use strict";

    /**
     * @description
     * <p>Storage of authenticated contacts.</p>
     *
     * <p>
     * A container (key ring) that keeps information of the authentication state
     * for all authenticated contacts. Each record is indicated by the contact's
     * userhandle as an attribute. The associated value is an object containing
     * the authenticated `fingerprint` of the Ed25519 public key, the authentication
     * `method` (e. g. `authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON`)
     * and the key `confidence` (e. g. `authring.KEY_CONFIDENCE.UNSURE`).</p>
     *
     * <p>
     * The records are stored in a concatenated fashion, with each user handle
     * represented in its compact 8 byte form followed by a the fingerprint as a
     * byte string and a "trust indicator" byte containing the authentication and
     * confidence information. Therefore each authenticated user "consumes"
     * 29 bytes of storage.</p>
     *
     * <p>
     * Load contacts' authentication info with `authring.getContacts()` and save
     * with `authring.setContacts()`.</p>
     */
    var ns = {};
    var logger = MegaLogger.getLogger('authring');

    /**
     * "Enumeration" of authentication methods. The values in here must fit
     * into 4 bits of a byte.
     *
     * @property SEEN {integer}
     *     To record a "seen" fingerprint, to be able to check for future changes.
     * @property FINGERPRINT_COMPARISON {integer}
     *     Direct/full fingerprint comparison.
     * @property SIGNATURE_VERIFIED {integer}
     *     Verified key's signature.
     */
    ns.AUTHENTICATION_METHOD = {
        SEEN: 0x00,
        FINGERPRINT_COMPARISON: 0x01,
        SIGNATURE_VERIFIED: 0x02,
    };


    /**
     * "Enumeration" of confidence in contact's key. The values in here must fit
     * into 4 bits of a byte.
     *
     * @property FINGERPRINT_COMPARISON {integer}
     *     Direct fingerprint comparison.
     */
    ns.KEY_CONFIDENCE = {
        UNSURE: 0x00,
    };

    // User property names used for different key types.
    ns._properties = { 'Ed25519': 'authring',
                       'RSA': 'authRSA' };

    /**
     * Serialises a single authentication record.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param fingerprint {string}
     *     Fingerprint to authenticate as a byte or hex string.
     * @param method {byte}
     *     Indicator used for authentication method. One of
     *     authring.AUTHENTICATION_METHOD (e. g. FINGERPRINT_COMPARISON).
     * @param confidence {byte}
     *     Indicator used for confidence. One of authring.KEY_CONFIDENCE
     *     (e. g. UNSURE).
     * @returns {string}
     *     Single binary encoded authentication record.
     * @private
     */
    ns._serialiseRecord = function(userhandle, fingerprint, method, confidence) {
        var fingerprintString = fingerprint;
        if (fingerprint.length !== 20) {
            // Assuming a hex fingerprint has been passed.
            fingerprintString = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fingerprint));
        }
        return base64urldecode(userhandle)
               + fingerprintString
               + String.fromCharCode((confidence << 4) | method);
    };


    /**
     * Generates a binary encoded serialisation of an authentication ring
     * object.
     *
     * @param container {object}
     *     Object containing (non-nested) authentication records for Mega user
     *     handles (as keys) and `fingerprint`, `method` and `confidence` as
     *     attributes of the `value` object.
     * @returns {string}
     *     Single binary encoded serialisation of authentication ring.
     */
    ns.serialise = function(container) {
        var result = '';
        for (var userhandle in container) {
            result += this._serialiseRecord(userhandle,
                                            container[userhandle].fingerprint,
                                            container[userhandle].method,
                                            container[userhandle].confidence);
        }
        return result;
    };


    /**
     * Splits and decodes an authentication record off of a binary keyring
     * serialisation and returns the record and the rest.
     *
     * @param serialisedRing {string}
     *     Single binary encoded container of authentication records.
     * @returns {object}
     *     Object containing three elements: `userhandle` contains the Mega
     *     user handle, `value` contains an object (with the `fingerprint` in a
     *     byte string, authentication `method` and key `confidence`) and `rest`
     *     containing the remainder of the serialisedRing still to decode.
     * @private
     */
    ns._deserialiseRecord = function(serialisedRing) {
        var userhandle = base64urlencode(serialisedRing.substring(0, 8));
        var fingerprint =  serialisedRing.substring(8, 28);
        var authAttributes = serialisedRing.charCodeAt(28);
        var rest = serialisedRing.substring(29);
        var confidence = (authAttributes >>> 4) & 0x0f;
        var method = authAttributes & 0x0f;
        return { userhandle: userhandle,
                 value: { fingerprint: fingerprint,
                          method: method,
                          confidence: confidence },
                 rest: rest };
    };


    /**
     * Decodes a binary encoded serialisation to an authentication ring object.
     *
     * @param serialisedRing {string}
     *     Single binary encoded serialisation of authentication records.
     * @returns {object}
     *     Object containing (non-nested) authentication records for Mega user
     *     handles (as keys) and `fingerprint`, `method` and `confidence` as
     *     attributes of the `value` object.
     */
    ns.deserialise = function(serialisedRing) {
        var rest = serialisedRing;
        var container = {};
        while (rest.length > 0) {
            var result = ns._deserialiseRecord(rest);
            container[result.userhandle] = result.value;
            rest = result.rest;
        }
        return container;
    };


    /**
     * Loads the ring for all authenticated contacts into `u_authring`.
     *
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.getContacts = function(keyType) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte authentication key type: ' + keyType);
        }

        var thePromise = getUserAttribute(u_handle, ns._properties[keyType],
                                          false, true);
        return thePromise.then(
            // Function on fulfilment.
            function(result, ctx) {
                if (typeof result !== 'number') {
                    // Authring is in the empty-name record.
                    u_authring[keyType] = ns.deserialise(result['']);
                    logger.debug('Got authentication ring for key type '
                                 + keyType + '.');
                    thePromise.resolve(u_authring[keyType], ctx);
                } else {
                    logger.error('Error retrieving authentication ring for key type '
                                 + keyType + ': ' + result);
                    thePromise.reject(result, ctx);
                }
            },
            // Function on rejection.
            function(result, ctx) {
                logger.error('Error retrieving authentication ring for key type '
                             + keyType + ': ' + result);
                thePromise.reject(result, ctx);
            }
        );
    };


    /**
     * Saves the ring for all authenticated contacts from `u_authring`.
     *
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.setContacts = function(keyType, callback) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte authentication key type: ' + keyType);
        }

        return setUserAttribute(ns._properties[keyType],
                                { '': ns.serialise(u_authring[keyType]) },
                                false, true);
    };


    /**
     * Gets the authentication state of a certain contact for a particular key type.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @return {object}
     *     An object describing the authenticated `fingerprint`, the
     *     authentication `method` and the key `confidence`. `false` in case
     *     of an unauthorised contact.
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.getContactAuthenticated = function(userhandle, keyType) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte key type: ' + keyType);
        }
        if (u_authring[keyType] === undefined) {
            throw new Error('First initialise u_authring by calling authring.getContacts()');
        }
        if (u_authring[keyType].hasOwnProperty(userhandle)) {
            return u_authring[keyType][userhandle];
        } else {
            return false;
        }
    };


    /**
     * Stores a contact authentication for a particular key type.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param fingerprint {string}
     *     Fingerprint to authenticate as a byte or hex string.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @param method {byte}
     *     Indicator used for authentication method. One of
     *     authring.AUTHENTICATION_METHOD (e. g. FINGERPRINT_COMPARISON).
     * @param confidence {byte}
     *     Indicator used for confidence. One of authring.KEY_CONFIDENCE
     *     (e. g. UNSURE).
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.setContactAuthenticated = function(userhandle, fingerprint, keyType,
                                          method, confidence) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte key type: ' + keyType);
        }
        if (u_authring[keyType] === undefined) {
            throw new Error('First initialise u_authring by calling authring.getContacts()');
        }
        if (userhandle === u_handle) {
            // We don't want to track ourself. Let's get out of here.
            return;
        }
        u_authring[keyType][userhandle] = { fingerprint: fingerprint,
                                            method: method,
                                            confidence: confidence };
        ns.setContacts(keyType);
    };


    /**
     * Computes the given public key's cryptographic fingerprint.
     *
     * @param key {string}
     *     Byte string of key.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @param format {string}
     *     Format in which to return the fingerprint. Valid values: "string"
     *     and "hex" (default: "hex").
     * @return {string}
     *     Fingerprint value in the requested format.
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.computeFingerprint = function(key, keyType, format) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte key type: ' + keyType);
        }
        format = format || 'hex';
        keyType = keyType || 'Ed25519';
        var value = key;
        if (keyType === 'Ed25519') {
            if (key.length !== 32) {
                throw new Error('Unexpected Ed25519 key length: ' + key.length);
            }
        }
        else if (keyType === 'RSA') {
            value = key[0] + key[1];
        }
        else {
            throw new Error('Unexpected key type for fingerprinting: ' + keyType);
        }
        if (format === "string") {
            return asmCrypto.bytes_to_string(asmCrypto.SHA256.bytes(value)).substring(0, 20);
        } else if (format === "hex") {
            return asmCrypto.SHA256.hex(value).substring(0, 40);
        }
    };


    /**
     * Signs the given public key using our own Ed25519 key.
     *
     * @param pubKey {array}
     *     Array format of public key. Index 0 is the modulo, index 1 is the
     *     exponent, both in byte string format.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @return {string}
     *     EdDSA signature of the key as a byte string.
     * @throws
     *     An error if an unsupported key type is requested.
     */
    ns.signKey = function(pubKey, keyType) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte key type: ' + keyType);
        }
        var timeStamp = ns._longToByteString(Math.round(Date.now() / 1000));
        var value = pubKey;
        if (keyType === 'RSA') {
            value = pubKey[0] + pubKey[1];
        }
        var keyString = 'keyauth' + timeStamp + value;
        return timeStamp + jodid25519.eddsa.sign(keyString, u_privEd25519, u_pubEd25519);
    };


    /**
     * Verifies the signature of the given public key's against the
     * contact's Ed25519 key.
     *
     * @param signature {string}
     *     EdDSA signature in byte string format.
     * @param pubKey {array}
     *     Array format of public key. Index 0 is the modulo, index 1 is the
     *     exponent, both in byte string format.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @param signPubKey {string}
     *     Contact's Ed25519 public key to verify the signature.
     * @return {bool}
     *     True on a good signature verification, false otherwise.
     * @throws
     *     An error if the signed key's time stamp is in the future, or if an
     *     unsupported key type is requested.
     */
    ns.verifyKey = function(signature, pubKey, keyType, signPubKey) {
        if (ns._properties[keyType] === undefined) {
            throw new Error('Unsupporte key type: ' + keyType);
        }
        var timestamp = signature.substring(0, 8);
        var timestampValue = ns._byteStringToLong(timestamp);
        if (timestampValue > Math.round(Date.now() / 1000)) {
            throw new Error('Bad timestamp: In the future!');
        }
        var value = pubKey;
        if (keyType === 'RSA') {
            value = pubKey[0] + pubKey[1];
        }
        var keyString = 'keyauth' + timestamp + value;
        var signatureValue = signature.substring(8);
        try {
            return jodid25519.eddsa.verify(signatureValue, keyString, signPubKey);
        } catch(e){
            if (e === "Point is not on curve") {
                return false;
            } else {
                throw e;
            }
        }
    };


    /**
     * Compare two fingerprints.
     *
     * @param fp1 {string}
     *     First fingerprint in byte or hex string format.
     * @param fp2 {string}
     *     Second fingerprint. in byte or hex string format
     * @return {bool}
     *     True on equality, `undefined` if one fingerprint is undefined,
     *     false otherwise.
     */
    ns.equalFingerprints = function(fp1, fp2) {
        if (fp1 === undefined || fp2 === undefined) {
            return undefined;
        }
        if (fp1.length !== 20) {
            fp1 = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fp1));
        }
        if (fp2.length !== 20) {
            fp2 = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fp2));
        }
        return fp1 === fp2;
    };


    /**
     * Convert a long integer (> 32-bit) to an 8-byte bit-endian string.
     *
     * @param value {integer}
     *     Integer input.
     * @return {string}
     *     Big-endian byte string representation.
     * @throws
     *     An error if the value is too large for JavaScript to encode it.
     */
    ns._longToByteString = function(value) {
        if (value > 9007199254740991) {
            // Check for value > Number.MAX_SAFE_INTEGER (not available in all JS).
            throw new Error('Integer not suitable for lossless conversion in JavaScript.');
        }
        var result = '';

        for (var i = 0; i < 8; i++ ) {
            result = String.fromCharCode(value & 0xff) + result;
            value = Math.floor(value / 0x100);
        }

        return result;
    };


    /**
     * Convert an 8-byte bit-endian string to a long integer (> 32-bit).
     *
     * @param sequence {string}
     *     Big-endian byte string representation.
     * @return {intenger}
     *     Integer representation.
     * @throws
     *     An error if the value is too large for JavaScript to encode it.
     */
    ns._byteStringToLong = function(sequence) {
        var value = 0;
        for (var i = 0; i < 8; i++) {
            value = (value * 256) + sequence.charCodeAt(i);
        }
        if (value > 9007199254740991) {
         // Check for value > Number.MAX_SAFE_INTEGER (not available in all JS).
            throw new Error('Integer not suitable for lossless conversion in JavaScript.');
        }

        return value;
    };


    /**
     * Purges all fingerprints from the authentication rings.
     *
     * @return
     *     void
     */
    ns.scrubAuthRing = function() {
        u_authring.Ed25519 = {};
        ns.setContacts('Ed25519');
        u_authring.RSA = {};
        ns.setContacts('RSA');
    };


    /**
     * Initialises the authentication system.
     *
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.initAuthenticationSystem = function() {
        // Load private key.
        var keyringApiPromise = getUserAttribute(u_handle, 'keyring', false, false);
        keyringApiPromise.then(
            // Function on resolution.
            function(result, ctx) {
                // Set local values.
                u_keyring = result;
                u_attr.keyring = u_keyring;
                u_privEd25519 = u_keyring.prEd255;
                u_pubEd25519 = jodid25519.eddsa.publicKey(u_privEd25519);
                u_attr.puEd255 = u_pubEd25519;
                pubEd25519[u_handle] = u_pubEd25519;
                // Run on the side a sanity check on the stored pub key.
                ns._checkEd25519PubKey();
                // Resolve the promise.
                keyringApiPromise.resolve(true, ctx);
            },
            // Function on rejection.
            function(result, ctx) {
                if (result === -9) {
                    // We don't have it set up, yet. Let's do so now.
                    logger.warn('Authentication system seems unavailable.');
                    var setUpPromise = ns.setUpAuthenticationSystem();
                    setUpPromise.then(
                        // Function on resolution.
                        function(result, ctx) {
                            keyringApiPromise.resolve();
                        },
                        // Function on rejection.
                        function(result, ctx) {
                            keyringApiPromise.reject();
                        }
                    );
                }
                else {
                    logger.error('Error retrieving Ed25519 authentication ring: '
                                 + result);
                    keyringApiPromise.reject(result, ctx);
                }
            }
        );

        // Load contacts' tracked authentication fingerprints.
        var authringPromise = authring.getContacts('Ed25519');
        var authRsaPromise = authring.getContacts('RSA');

        return MegaPromise.allDone([keyringApiPromise, authringPromise,
                                    authRsaPromise]);
    };


    ns._checkEd25519PubKey = function() {
        var thePromise = getUserAttribute(u_handle, "puEd255", true, false);

        function setKey() {
            var setPromise = setUserAttribute('puEd255',
                                              base64urlencode(u_pubEd25519),
                                              true, false);
            setPromise.then(
                // Function on resolution for set.
                function(result, ctx) {
                    logger.debug('Ed25519 pub key updated.');
                    thePromise.resolve(true, ctx);
                },
                // Function on rejection for set.
                function(result, ctx) {
                    logger.error('Error updating Ed25519 pub key.');
                    thePromise.reject(false, ctx);
                }
            );
        }

        thePromise.then(
            // Function on resolution for get.
            function(result, ctx) {
                var storedPubKey = base64urldecode(result)
                if (storedPubKey === u_pubEd25519) {
                    thePromise.resolve(true, ctx);
                }
                else {
                    logger.info('Need to update Ed25519 pub key.');
                    setKey();
                }
            },
            // Function on rejection for get.
            function(result, ctx) {
                logger.warn('Could not get my Ed25519 pub key, setting it now.');
                setKey();
            }
        );
    };


    /**
     * Sets up the authentication system by generating an Ed25519 key pair,
     * signing the RSA public key and creating authentication rings.
     * Current Ed25519 key pair and RSA pub key signature will be replaced.
     *
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.setUpAuthenticationSystem = function() {
        logger.debug('Setting up authentication system'
                     + ' (Ed25519 keys, RSA pub key signature).');
        // Make a new key pair.
        u_privEd25519 = jodid25519.eddsa.generateKeySeed();
        u_keyring = { prEd255: u_privEd25519 };
        u_pubEd25519 = jodid25519.eddsa.publicKey(u_privEd25519);

        // Store the key pair.
        var pubkeyPromise = setUserAttribute('puEd255',
                                             base64urlencode(u_pubEd25519),
                                             true, false);
        // Keyring is a private attribute here, so no preprocessing required
        // (will be wrapped in a TLV store).
        var keyringPromise = setUserAttribute('keyring', u_keyring, false,
                                              false);

        // Set local values and make the authrings.
        u_attr.keyring = u_keyring;
        u_attr.puEd255 = u_pubEd25519;
        pubEd25519[u_handle] = u_pubEd25519;
        u_authring = { Ed25519: {}, RSA: {}};
        var edAuthringPromise = ns.setContacts('Ed25519');
        var rsaAuthringPromise = ns.setContacts('RSA');

        // Ensure an RSA pub key signature.
        var sigPubk = authring.signKey(crypto_decodepubkey(base64urldecode(u_attr.pubk)),
                                       'RSA');
        var rsaSigKeyPromise = setUserAttribute('sigPubk',
                                                base64urlencode(sigPubk), true,
                                                false);

        return MegaPromise.allDone([pubkeyPromise, keyringPromise,
                                    rsaSigKeyPromise, edAuthringPromise,
                                    rsaAuthringPromise]);
    };


    return ns;
}());
