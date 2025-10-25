/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.MarketLevel = (function() {

    /**
     * Properties of a MarketLevel.
     * @exports IMarketLevel
     * @interface IMarketLevel
     * @property {google.protobuf.IInt64Value|null} [price] MarketLevel price
     * @property {google.protobuf.IUInt32Value|null} [qty] MarketLevel qty
     * @property {google.protobuf.IUInt32Value|null} [nord] MarketLevel nord
     * @property {google.protobuf.IUInt32Value|null} [num] MarketLevel num
     */

    /**
     * Constructs a new MarketLevel.
     * @exports MarketLevel
     * @classdesc Represents a MarketLevel.
     * @implements IMarketLevel
     * @constructor
     * @param {IMarketLevel=} [properties] Properties to set
     */
    function MarketLevel(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MarketLevel price.
     * @member {google.protobuf.IInt64Value|null|undefined} price
     * @memberof MarketLevel
     * @instance
     */
    MarketLevel.prototype.price = null;

    /**
     * MarketLevel qty.
     * @member {google.protobuf.IUInt32Value|null|undefined} qty
     * @memberof MarketLevel
     * @instance
     */
    MarketLevel.prototype.qty = null;

    /**
     * MarketLevel nord.
     * @member {google.protobuf.IUInt32Value|null|undefined} nord
     * @memberof MarketLevel
     * @instance
     */
    MarketLevel.prototype.nord = null;

    /**
     * MarketLevel num.
     * @member {google.protobuf.IUInt32Value|null|undefined} num
     * @memberof MarketLevel
     * @instance
     */
    MarketLevel.prototype.num = null;

    /**
     * Creates a new MarketLevel instance using the specified properties.
     * @function create
     * @memberof MarketLevel
     * @static
     * @param {IMarketLevel=} [properties] Properties to set
     * @returns {MarketLevel} MarketLevel instance
     */
    MarketLevel.create = function create(properties) {
        return new MarketLevel(properties);
    };

    /**
     * Encodes the specified MarketLevel message. Does not implicitly {@link MarketLevel.verify|verify} messages.
     * @function encode
     * @memberof MarketLevel
     * @static
     * @param {IMarketLevel} message MarketLevel message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MarketLevel.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.price != null && Object.hasOwnProperty.call(message, "price"))
            $root.google.protobuf.Int64Value.encode(message.price, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.qty != null && Object.hasOwnProperty.call(message, "qty"))
            $root.google.protobuf.UInt32Value.encode(message.qty, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.nord != null && Object.hasOwnProperty.call(message, "nord"))
            $root.google.protobuf.UInt32Value.encode(message.nord, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.num != null && Object.hasOwnProperty.call(message, "num"))
            $root.google.protobuf.UInt32Value.encode(message.num, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MarketLevel message, length delimited. Does not implicitly {@link MarketLevel.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MarketLevel
     * @static
     * @param {IMarketLevel} message MarketLevel message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MarketLevel.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MarketLevel message from the specified reader or buffer.
     * @function decode
     * @memberof MarketLevel
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MarketLevel} MarketLevel
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MarketLevel.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MarketLevel();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.price = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.qty = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.nord = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.num = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MarketLevel message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MarketLevel
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MarketLevel} MarketLevel
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MarketLevel.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MarketLevel message.
     * @function verify
     * @memberof MarketLevel
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MarketLevel.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.price != null && message.hasOwnProperty("price")) {
            var error = $root.google.protobuf.Int64Value.verify(message.price);
            if (error)
                return "price." + error;
        }
        if (message.qty != null && message.hasOwnProperty("qty")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.qty);
            if (error)
                return "qty." + error;
        }
        if (message.nord != null && message.hasOwnProperty("nord")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.nord);
            if (error)
                return "nord." + error;
        }
        if (message.num != null && message.hasOwnProperty("num")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.num);
            if (error)
                return "num." + error;
        }
        return null;
    };

    /**
     * Creates a MarketLevel message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MarketLevel
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MarketLevel} MarketLevel
     */
    MarketLevel.fromObject = function fromObject(object) {
        if (object instanceof $root.MarketLevel)
            return object;
        var message = new $root.MarketLevel();
        if (object.price != null) {
            if (typeof object.price !== "object")
                throw TypeError(".MarketLevel.price: object expected");
            message.price = $root.google.protobuf.Int64Value.fromObject(object.price);
        }
        if (object.qty != null) {
            if (typeof object.qty !== "object")
                throw TypeError(".MarketLevel.qty: object expected");
            message.qty = $root.google.protobuf.UInt32Value.fromObject(object.qty);
        }
        if (object.nord != null) {
            if (typeof object.nord !== "object")
                throw TypeError(".MarketLevel.nord: object expected");
            message.nord = $root.google.protobuf.UInt32Value.fromObject(object.nord);
        }
        if (object.num != null) {
            if (typeof object.num !== "object")
                throw TypeError(".MarketLevel.num: object expected");
            message.num = $root.google.protobuf.UInt32Value.fromObject(object.num);
        }
        return message;
    };

    /**
     * Creates a plain object from a MarketLevel message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MarketLevel
     * @static
     * @param {MarketLevel} message MarketLevel
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MarketLevel.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.price = null;
            object.qty = null;
            object.nord = null;
            object.num = null;
        }
        if (message.price != null && message.hasOwnProperty("price"))
            object.price = $root.google.protobuf.Int64Value.toObject(message.price, options);
        if (message.qty != null && message.hasOwnProperty("qty"))
            object.qty = $root.google.protobuf.UInt32Value.toObject(message.qty, options);
        if (message.nord != null && message.hasOwnProperty("nord"))
            object.nord = $root.google.protobuf.UInt32Value.toObject(message.nord, options);
        if (message.num != null && message.hasOwnProperty("num"))
            object.num = $root.google.protobuf.UInt32Value.toObject(message.num, options);
        return object;
    };

    /**
     * Converts this MarketLevel to JSON.
     * @function toJSON
     * @memberof MarketLevel
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MarketLevel.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for MarketLevel
     * @function getTypeUrl
     * @memberof MarketLevel
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    MarketLevel.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/MarketLevel";
    };

    return MarketLevel;
})();

$root.Depth = (function() {

    /**
     * Properties of a Depth.
     * @exports IDepth
     * @interface IDepth
     * @property {google.protobuf.IUInt64Value|null} [tbq] Depth tbq
     * @property {google.protobuf.IUInt64Value|null} [tsq] Depth tsq
     * @property {Array.<IMarketLevel>|null} [asks] Depth asks
     * @property {Array.<IMarketLevel>|null} [bids] Depth bids
     */

    /**
     * Constructs a new Depth.
     * @exports Depth
     * @classdesc Represents a Depth.
     * @implements IDepth
     * @constructor
     * @param {IDepth=} [properties] Properties to set
     */
    function Depth(properties) {
        this.asks = [];
        this.bids = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Depth tbq.
     * @member {google.protobuf.IUInt64Value|null|undefined} tbq
     * @memberof Depth
     * @instance
     */
    Depth.prototype.tbq = null;

    /**
     * Depth tsq.
     * @member {google.protobuf.IUInt64Value|null|undefined} tsq
     * @memberof Depth
     * @instance
     */
    Depth.prototype.tsq = null;

    /**
     * Depth asks.
     * @member {Array.<IMarketLevel>} asks
     * @memberof Depth
     * @instance
     */
    Depth.prototype.asks = $util.emptyArray;

    /**
     * Depth bids.
     * @member {Array.<IMarketLevel>} bids
     * @memberof Depth
     * @instance
     */
    Depth.prototype.bids = $util.emptyArray;

    /**
     * Creates a new Depth instance using the specified properties.
     * @function create
     * @memberof Depth
     * @static
     * @param {IDepth=} [properties] Properties to set
     * @returns {Depth} Depth instance
     */
    Depth.create = function create(properties) {
        return new Depth(properties);
    };

    /**
     * Encodes the specified Depth message. Does not implicitly {@link Depth.verify|verify} messages.
     * @function encode
     * @memberof Depth
     * @static
     * @param {IDepth} message Depth message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Depth.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.tbq != null && Object.hasOwnProperty.call(message, "tbq"))
            $root.google.protobuf.UInt64Value.encode(message.tbq, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.tsq != null && Object.hasOwnProperty.call(message, "tsq"))
            $root.google.protobuf.UInt64Value.encode(message.tsq, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.asks != null && message.asks.length)
            for (var i = 0; i < message.asks.length; ++i)
                $root.MarketLevel.encode(message.asks[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.bids != null && message.bids.length)
            for (var i = 0; i < message.bids.length; ++i)
                $root.MarketLevel.encode(message.bids[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Depth message, length delimited. Does not implicitly {@link Depth.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Depth
     * @static
     * @param {IDepth} message Depth message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Depth.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Depth message from the specified reader or buffer.
     * @function decode
     * @memberof Depth
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Depth} Depth
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Depth.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Depth();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.tbq = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.tsq = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    if (!(message.asks && message.asks.length))
                        message.asks = [];
                    message.asks.push($root.MarketLevel.decode(reader, reader.uint32()));
                    break;
                }
            case 4: {
                    if (!(message.bids && message.bids.length))
                        message.bids = [];
                    message.bids.push($root.MarketLevel.decode(reader, reader.uint32()));
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Depth message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Depth
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Depth} Depth
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Depth.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Depth message.
     * @function verify
     * @memberof Depth
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Depth.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.tbq != null && message.hasOwnProperty("tbq")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.tbq);
            if (error)
                return "tbq." + error;
        }
        if (message.tsq != null && message.hasOwnProperty("tsq")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.tsq);
            if (error)
                return "tsq." + error;
        }
        if (message.asks != null && message.hasOwnProperty("asks")) {
            if (!Array.isArray(message.asks))
                return "asks: array expected";
            for (var i = 0; i < message.asks.length; ++i) {
                var error = $root.MarketLevel.verify(message.asks[i]);
                if (error)
                    return "asks." + error;
            }
        }
        if (message.bids != null && message.hasOwnProperty("bids")) {
            if (!Array.isArray(message.bids))
                return "bids: array expected";
            for (var i = 0; i < message.bids.length; ++i) {
                var error = $root.MarketLevel.verify(message.bids[i]);
                if (error)
                    return "bids." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Depth message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Depth
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Depth} Depth
     */
    Depth.fromObject = function fromObject(object) {
        if (object instanceof $root.Depth)
            return object;
        var message = new $root.Depth();
        if (object.tbq != null) {
            if (typeof object.tbq !== "object")
                throw TypeError(".Depth.tbq: object expected");
            message.tbq = $root.google.protobuf.UInt64Value.fromObject(object.tbq);
        }
        if (object.tsq != null) {
            if (typeof object.tsq !== "object")
                throw TypeError(".Depth.tsq: object expected");
            message.tsq = $root.google.protobuf.UInt64Value.fromObject(object.tsq);
        }
        if (object.asks) {
            if (!Array.isArray(object.asks))
                throw TypeError(".Depth.asks: array expected");
            message.asks = [];
            for (var i = 0; i < object.asks.length; ++i) {
                if (typeof object.asks[i] !== "object")
                    throw TypeError(".Depth.asks: object expected");
                message.asks[i] = $root.MarketLevel.fromObject(object.asks[i]);
            }
        }
        if (object.bids) {
            if (!Array.isArray(object.bids))
                throw TypeError(".Depth.bids: array expected");
            message.bids = [];
            for (var i = 0; i < object.bids.length; ++i) {
                if (typeof object.bids[i] !== "object")
                    throw TypeError(".Depth.bids: object expected");
                message.bids[i] = $root.MarketLevel.fromObject(object.bids[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a Depth message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Depth
     * @static
     * @param {Depth} message Depth
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Depth.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.asks = [];
            object.bids = [];
        }
        if (options.defaults) {
            object.tbq = null;
            object.tsq = null;
        }
        if (message.tbq != null && message.hasOwnProperty("tbq"))
            object.tbq = $root.google.protobuf.UInt64Value.toObject(message.tbq, options);
        if (message.tsq != null && message.hasOwnProperty("tsq"))
            object.tsq = $root.google.protobuf.UInt64Value.toObject(message.tsq, options);
        if (message.asks && message.asks.length) {
            object.asks = [];
            for (var j = 0; j < message.asks.length; ++j)
                object.asks[j] = $root.MarketLevel.toObject(message.asks[j], options);
        }
        if (message.bids && message.bids.length) {
            object.bids = [];
            for (var j = 0; j < message.bids.length; ++j)
                object.bids[j] = $root.MarketLevel.toObject(message.bids[j], options);
        }
        return object;
    };

    /**
     * Converts this Depth to JSON.
     * @function toJSON
     * @memberof Depth
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Depth.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Depth
     * @function getTypeUrl
     * @memberof Depth
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Depth.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Depth";
    };

    return Depth;
})();

$root.Quote = (function() {

    /**
     * Properties of a Quote.
     * @exports IQuote
     * @interface IQuote
     * @property {google.protobuf.IInt64Value|null} [ltp] Quote ltp
     * @property {google.protobuf.IUInt32Value|null} [ltt] Quote ltt
     * @property {google.protobuf.IUInt32Value|null} [ltq] Quote ltq
     * @property {google.protobuf.IUInt64Value|null} [vtt] Quote vtt
     * @property {google.protobuf.IUInt64Value|null} [vttDiff] Quote vttDiff
     * @property {google.protobuf.IUInt64Value|null} [oi] Quote oi
     * @property {google.protobuf.IInt64Value|null} [ltpc] Quote ltpc
     */

    /**
     * Constructs a new Quote.
     * @exports Quote
     * @classdesc Represents a Quote.
     * @implements IQuote
     * @constructor
     * @param {IQuote=} [properties] Properties to set
     */
    function Quote(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Quote ltp.
     * @member {google.protobuf.IInt64Value|null|undefined} ltp
     * @memberof Quote
     * @instance
     */
    Quote.prototype.ltp = null;

    /**
     * Quote ltt.
     * @member {google.protobuf.IUInt32Value|null|undefined} ltt
     * @memberof Quote
     * @instance
     */
    Quote.prototype.ltt = null;

    /**
     * Quote ltq.
     * @member {google.protobuf.IUInt32Value|null|undefined} ltq
     * @memberof Quote
     * @instance
     */
    Quote.prototype.ltq = null;

    /**
     * Quote vtt.
     * @member {google.protobuf.IUInt64Value|null|undefined} vtt
     * @memberof Quote
     * @instance
     */
    Quote.prototype.vtt = null;

    /**
     * Quote vttDiff.
     * @member {google.protobuf.IUInt64Value|null|undefined} vttDiff
     * @memberof Quote
     * @instance
     */
    Quote.prototype.vttDiff = null;

    /**
     * Quote oi.
     * @member {google.protobuf.IUInt64Value|null|undefined} oi
     * @memberof Quote
     * @instance
     */
    Quote.prototype.oi = null;

    /**
     * Quote ltpc.
     * @member {google.protobuf.IInt64Value|null|undefined} ltpc
     * @memberof Quote
     * @instance
     */
    Quote.prototype.ltpc = null;

    /**
     * Creates a new Quote instance using the specified properties.
     * @function create
     * @memberof Quote
     * @static
     * @param {IQuote=} [properties] Properties to set
     * @returns {Quote} Quote instance
     */
    Quote.create = function create(properties) {
        return new Quote(properties);
    };

    /**
     * Encodes the specified Quote message. Does not implicitly {@link Quote.verify|verify} messages.
     * @function encode
     * @memberof Quote
     * @static
     * @param {IQuote} message Quote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Quote.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.ltp != null && Object.hasOwnProperty.call(message, "ltp"))
            $root.google.protobuf.Int64Value.encode(message.ltp, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.ltt != null && Object.hasOwnProperty.call(message, "ltt"))
            $root.google.protobuf.UInt32Value.encode(message.ltt, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.ltq != null && Object.hasOwnProperty.call(message, "ltq"))
            $root.google.protobuf.UInt32Value.encode(message.ltq, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.vtt != null && Object.hasOwnProperty.call(message, "vtt"))
            $root.google.protobuf.UInt64Value.encode(message.vtt, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.vttDiff != null && Object.hasOwnProperty.call(message, "vttDiff"))
            $root.google.protobuf.UInt64Value.encode(message.vttDiff, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.oi != null && Object.hasOwnProperty.call(message, "oi"))
            $root.google.protobuf.UInt64Value.encode(message.oi, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.ltpc != null && Object.hasOwnProperty.call(message, "ltpc"))
            $root.google.protobuf.Int64Value.encode(message.ltpc, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Quote message, length delimited. Does not implicitly {@link Quote.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Quote
     * @static
     * @param {IQuote} message Quote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Quote.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Quote message from the specified reader or buffer.
     * @function decode
     * @memberof Quote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Quote} Quote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Quote.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Quote();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.ltp = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.ltt = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.ltq = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.vtt = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 5: {
                    message.vttDiff = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.oi = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 7: {
                    message.ltpc = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Quote message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Quote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Quote} Quote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Quote.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Quote message.
     * @function verify
     * @memberof Quote
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Quote.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.ltp != null && message.hasOwnProperty("ltp")) {
            var error = $root.google.protobuf.Int64Value.verify(message.ltp);
            if (error)
                return "ltp." + error;
        }
        if (message.ltt != null && message.hasOwnProperty("ltt")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.ltt);
            if (error)
                return "ltt." + error;
        }
        if (message.ltq != null && message.hasOwnProperty("ltq")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.ltq);
            if (error)
                return "ltq." + error;
        }
        if (message.vtt != null && message.hasOwnProperty("vtt")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.vtt);
            if (error)
                return "vtt." + error;
        }
        if (message.vttDiff != null && message.hasOwnProperty("vttDiff")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.vttDiff);
            if (error)
                return "vttDiff." + error;
        }
        if (message.oi != null && message.hasOwnProperty("oi")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.oi);
            if (error)
                return "oi." + error;
        }
        if (message.ltpc != null && message.hasOwnProperty("ltpc")) {
            var error = $root.google.protobuf.Int64Value.verify(message.ltpc);
            if (error)
                return "ltpc." + error;
        }
        return null;
    };

    /**
     * Creates a Quote message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Quote
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Quote} Quote
     */
    Quote.fromObject = function fromObject(object) {
        if (object instanceof $root.Quote)
            return object;
        var message = new $root.Quote();
        if (object.ltp != null) {
            if (typeof object.ltp !== "object")
                throw TypeError(".Quote.ltp: object expected");
            message.ltp = $root.google.protobuf.Int64Value.fromObject(object.ltp);
        }
        if (object.ltt != null) {
            if (typeof object.ltt !== "object")
                throw TypeError(".Quote.ltt: object expected");
            message.ltt = $root.google.protobuf.UInt32Value.fromObject(object.ltt);
        }
        if (object.ltq != null) {
            if (typeof object.ltq !== "object")
                throw TypeError(".Quote.ltq: object expected");
            message.ltq = $root.google.protobuf.UInt32Value.fromObject(object.ltq);
        }
        if (object.vtt != null) {
            if (typeof object.vtt !== "object")
                throw TypeError(".Quote.vtt: object expected");
            message.vtt = $root.google.protobuf.UInt64Value.fromObject(object.vtt);
        }
        if (object.vttDiff != null) {
            if (typeof object.vttDiff !== "object")
                throw TypeError(".Quote.vttDiff: object expected");
            message.vttDiff = $root.google.protobuf.UInt64Value.fromObject(object.vttDiff);
        }
        if (object.oi != null) {
            if (typeof object.oi !== "object")
                throw TypeError(".Quote.oi: object expected");
            message.oi = $root.google.protobuf.UInt64Value.fromObject(object.oi);
        }
        if (object.ltpc != null) {
            if (typeof object.ltpc !== "object")
                throw TypeError(".Quote.ltpc: object expected");
            message.ltpc = $root.google.protobuf.Int64Value.fromObject(object.ltpc);
        }
        return message;
    };

    /**
     * Creates a plain object from a Quote message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Quote
     * @static
     * @param {Quote} message Quote
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Quote.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.ltp = null;
            object.ltt = null;
            object.ltq = null;
            object.vtt = null;
            object.vttDiff = null;
            object.oi = null;
            object.ltpc = null;
        }
        if (message.ltp != null && message.hasOwnProperty("ltp"))
            object.ltp = $root.google.protobuf.Int64Value.toObject(message.ltp, options);
        if (message.ltt != null && message.hasOwnProperty("ltt"))
            object.ltt = $root.google.protobuf.UInt32Value.toObject(message.ltt, options);
        if (message.ltq != null && message.hasOwnProperty("ltq"))
            object.ltq = $root.google.protobuf.UInt32Value.toObject(message.ltq, options);
        if (message.vtt != null && message.hasOwnProperty("vtt"))
            object.vtt = $root.google.protobuf.UInt64Value.toObject(message.vtt, options);
        if (message.vttDiff != null && message.hasOwnProperty("vttDiff"))
            object.vttDiff = $root.google.protobuf.UInt64Value.toObject(message.vttDiff, options);
        if (message.oi != null && message.hasOwnProperty("oi"))
            object.oi = $root.google.protobuf.UInt64Value.toObject(message.oi, options);
        if (message.ltpc != null && message.hasOwnProperty("ltpc"))
            object.ltpc = $root.google.protobuf.Int64Value.toObject(message.ltpc, options);
        return object;
    };

    /**
     * Converts this Quote to JSON.
     * @function toJSON
     * @memberof Quote
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Quote.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Quote
     * @function getTypeUrl
     * @memberof Quote
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Quote.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Quote";
    };

    return Quote;
})();

$root.ExtendedQuote = (function() {

    /**
     * Properties of an ExtendedQuote.
     * @exports IExtendedQuote
     * @interface IExtendedQuote
     * @property {google.protobuf.IInt64Value|null} [atp] ExtendedQuote atp
     * @property {google.protobuf.IInt64Value|null} [cp] ExtendedQuote cp
     * @property {google.protobuf.IUInt32Value|null} [lc] ExtendedQuote lc
     * @property {google.protobuf.IUInt32Value|null} [uc] ExtendedQuote uc
     * @property {google.protobuf.IInt64Value|null} [yh] ExtendedQuote yh
     * @property {google.protobuf.IInt64Value|null} [yl] ExtendedQuote yl
     * @property {google.protobuf.IUInt64Value|null} [poi] ExtendedQuote poi
     * @property {google.protobuf.IInt64Value|null} [oich] ExtendedQuote oich
     * @property {google.protobuf.IUInt32Value|null} [pc] ExtendedQuote pc
     */

    /**
     * Constructs a new ExtendedQuote.
     * @exports ExtendedQuote
     * @classdesc Represents an ExtendedQuote.
     * @implements IExtendedQuote
     * @constructor
     * @param {IExtendedQuote=} [properties] Properties to set
     */
    function ExtendedQuote(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ExtendedQuote atp.
     * @member {google.protobuf.IInt64Value|null|undefined} atp
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.atp = null;

    /**
     * ExtendedQuote cp.
     * @member {google.protobuf.IInt64Value|null|undefined} cp
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.cp = null;

    /**
     * ExtendedQuote lc.
     * @member {google.protobuf.IUInt32Value|null|undefined} lc
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.lc = null;

    /**
     * ExtendedQuote uc.
     * @member {google.protobuf.IUInt32Value|null|undefined} uc
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.uc = null;

    /**
     * ExtendedQuote yh.
     * @member {google.protobuf.IInt64Value|null|undefined} yh
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.yh = null;

    /**
     * ExtendedQuote yl.
     * @member {google.protobuf.IInt64Value|null|undefined} yl
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.yl = null;

    /**
     * ExtendedQuote poi.
     * @member {google.protobuf.IUInt64Value|null|undefined} poi
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.poi = null;

    /**
     * ExtendedQuote oich.
     * @member {google.protobuf.IInt64Value|null|undefined} oich
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.oich = null;

    /**
     * ExtendedQuote pc.
     * @member {google.protobuf.IUInt32Value|null|undefined} pc
     * @memberof ExtendedQuote
     * @instance
     */
    ExtendedQuote.prototype.pc = null;

    /**
     * Creates a new ExtendedQuote instance using the specified properties.
     * @function create
     * @memberof ExtendedQuote
     * @static
     * @param {IExtendedQuote=} [properties] Properties to set
     * @returns {ExtendedQuote} ExtendedQuote instance
     */
    ExtendedQuote.create = function create(properties) {
        return new ExtendedQuote(properties);
    };

    /**
     * Encodes the specified ExtendedQuote message. Does not implicitly {@link ExtendedQuote.verify|verify} messages.
     * @function encode
     * @memberof ExtendedQuote
     * @static
     * @param {IExtendedQuote} message ExtendedQuote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ExtendedQuote.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.atp != null && Object.hasOwnProperty.call(message, "atp"))
            $root.google.protobuf.Int64Value.encode(message.atp, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.cp != null && Object.hasOwnProperty.call(message, "cp"))
            $root.google.protobuf.Int64Value.encode(message.cp, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.lc != null && Object.hasOwnProperty.call(message, "lc"))
            $root.google.protobuf.UInt32Value.encode(message.lc, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.uc != null && Object.hasOwnProperty.call(message, "uc"))
            $root.google.protobuf.UInt32Value.encode(message.uc, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.yh != null && Object.hasOwnProperty.call(message, "yh"))
            $root.google.protobuf.Int64Value.encode(message.yh, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.yl != null && Object.hasOwnProperty.call(message, "yl"))
            $root.google.protobuf.Int64Value.encode(message.yl, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.poi != null && Object.hasOwnProperty.call(message, "poi"))
            $root.google.protobuf.UInt64Value.encode(message.poi, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.oich != null && Object.hasOwnProperty.call(message, "oich"))
            $root.google.protobuf.Int64Value.encode(message.oich, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
        if (message.pc != null && Object.hasOwnProperty.call(message, "pc"))
            $root.google.protobuf.UInt32Value.encode(message.pc, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified ExtendedQuote message, length delimited. Does not implicitly {@link ExtendedQuote.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ExtendedQuote
     * @static
     * @param {IExtendedQuote} message ExtendedQuote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ExtendedQuote.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an ExtendedQuote message from the specified reader or buffer.
     * @function decode
     * @memberof ExtendedQuote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ExtendedQuote} ExtendedQuote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ExtendedQuote.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ExtendedQuote();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.atp = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.cp = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.lc = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.uc = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 5: {
                    message.yh = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.yl = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 7: {
                    message.poi = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 8: {
                    message.oich = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 9: {
                    message.pc = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an ExtendedQuote message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ExtendedQuote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ExtendedQuote} ExtendedQuote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ExtendedQuote.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an ExtendedQuote message.
     * @function verify
     * @memberof ExtendedQuote
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ExtendedQuote.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.atp != null && message.hasOwnProperty("atp")) {
            var error = $root.google.protobuf.Int64Value.verify(message.atp);
            if (error)
                return "atp." + error;
        }
        if (message.cp != null && message.hasOwnProperty("cp")) {
            var error = $root.google.protobuf.Int64Value.verify(message.cp);
            if (error)
                return "cp." + error;
        }
        if (message.lc != null && message.hasOwnProperty("lc")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.lc);
            if (error)
                return "lc." + error;
        }
        if (message.uc != null && message.hasOwnProperty("uc")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.uc);
            if (error)
                return "uc." + error;
        }
        if (message.yh != null && message.hasOwnProperty("yh")) {
            var error = $root.google.protobuf.Int64Value.verify(message.yh);
            if (error)
                return "yh." + error;
        }
        if (message.yl != null && message.hasOwnProperty("yl")) {
            var error = $root.google.protobuf.Int64Value.verify(message.yl);
            if (error)
                return "yl." + error;
        }
        if (message.poi != null && message.hasOwnProperty("poi")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.poi);
            if (error)
                return "poi." + error;
        }
        if (message.oich != null && message.hasOwnProperty("oich")) {
            var error = $root.google.protobuf.Int64Value.verify(message.oich);
            if (error)
                return "oich." + error;
        }
        if (message.pc != null && message.hasOwnProperty("pc")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.pc);
            if (error)
                return "pc." + error;
        }
        return null;
    };

    /**
     * Creates an ExtendedQuote message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ExtendedQuote
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ExtendedQuote} ExtendedQuote
     */
    ExtendedQuote.fromObject = function fromObject(object) {
        if (object instanceof $root.ExtendedQuote)
            return object;
        var message = new $root.ExtendedQuote();
        if (object.atp != null) {
            if (typeof object.atp !== "object")
                throw TypeError(".ExtendedQuote.atp: object expected");
            message.atp = $root.google.protobuf.Int64Value.fromObject(object.atp);
        }
        if (object.cp != null) {
            if (typeof object.cp !== "object")
                throw TypeError(".ExtendedQuote.cp: object expected");
            message.cp = $root.google.protobuf.Int64Value.fromObject(object.cp);
        }
        if (object.lc != null) {
            if (typeof object.lc !== "object")
                throw TypeError(".ExtendedQuote.lc: object expected");
            message.lc = $root.google.protobuf.UInt32Value.fromObject(object.lc);
        }
        if (object.uc != null) {
            if (typeof object.uc !== "object")
                throw TypeError(".ExtendedQuote.uc: object expected");
            message.uc = $root.google.protobuf.UInt32Value.fromObject(object.uc);
        }
        if (object.yh != null) {
            if (typeof object.yh !== "object")
                throw TypeError(".ExtendedQuote.yh: object expected");
            message.yh = $root.google.protobuf.Int64Value.fromObject(object.yh);
        }
        if (object.yl != null) {
            if (typeof object.yl !== "object")
                throw TypeError(".ExtendedQuote.yl: object expected");
            message.yl = $root.google.protobuf.Int64Value.fromObject(object.yl);
        }
        if (object.poi != null) {
            if (typeof object.poi !== "object")
                throw TypeError(".ExtendedQuote.poi: object expected");
            message.poi = $root.google.protobuf.UInt64Value.fromObject(object.poi);
        }
        if (object.oich != null) {
            if (typeof object.oich !== "object")
                throw TypeError(".ExtendedQuote.oich: object expected");
            message.oich = $root.google.protobuf.Int64Value.fromObject(object.oich);
        }
        if (object.pc != null) {
            if (typeof object.pc !== "object")
                throw TypeError(".ExtendedQuote.pc: object expected");
            message.pc = $root.google.protobuf.UInt32Value.fromObject(object.pc);
        }
        return message;
    };

    /**
     * Creates a plain object from an ExtendedQuote message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ExtendedQuote
     * @static
     * @param {ExtendedQuote} message ExtendedQuote
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ExtendedQuote.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.atp = null;
            object.cp = null;
            object.lc = null;
            object.uc = null;
            object.yh = null;
            object.yl = null;
            object.poi = null;
            object.oich = null;
            object.pc = null;
        }
        if (message.atp != null && message.hasOwnProperty("atp"))
            object.atp = $root.google.protobuf.Int64Value.toObject(message.atp, options);
        if (message.cp != null && message.hasOwnProperty("cp"))
            object.cp = $root.google.protobuf.Int64Value.toObject(message.cp, options);
        if (message.lc != null && message.hasOwnProperty("lc"))
            object.lc = $root.google.protobuf.UInt32Value.toObject(message.lc, options);
        if (message.uc != null && message.hasOwnProperty("uc"))
            object.uc = $root.google.protobuf.UInt32Value.toObject(message.uc, options);
        if (message.yh != null && message.hasOwnProperty("yh"))
            object.yh = $root.google.protobuf.Int64Value.toObject(message.yh, options);
        if (message.yl != null && message.hasOwnProperty("yl"))
            object.yl = $root.google.protobuf.Int64Value.toObject(message.yl, options);
        if (message.poi != null && message.hasOwnProperty("poi"))
            object.poi = $root.google.protobuf.UInt64Value.toObject(message.poi, options);
        if (message.oich != null && message.hasOwnProperty("oich"))
            object.oich = $root.google.protobuf.Int64Value.toObject(message.oich, options);
        if (message.pc != null && message.hasOwnProperty("pc"))
            object.pc = $root.google.protobuf.UInt32Value.toObject(message.pc, options);
        return object;
    };

    /**
     * Converts this ExtendedQuote to JSON.
     * @function toJSON
     * @memberof ExtendedQuote
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ExtendedQuote.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ExtendedQuote
     * @function getTypeUrl
     * @memberof ExtendedQuote
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ExtendedQuote.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/ExtendedQuote";
    };

    return ExtendedQuote;
})();

$root.DailyQuote = (function() {

    /**
     * Properties of a DailyQuote.
     * @exports IDailyQuote
     * @interface IDailyQuote
     * @property {google.protobuf.IInt64Value|null} ["do"] DailyQuote do
     * @property {google.protobuf.IInt64Value|null} [dh] DailyQuote dh
     * @property {google.protobuf.IInt64Value|null} [dl] DailyQuote dl
     * @property {google.protobuf.IInt64Value|null} [dc] DailyQuote dc
     * @property {google.protobuf.IUInt64Value|null} [dhoi] DailyQuote dhoi
     * @property {google.protobuf.IUInt64Value|null} [dloi] DailyQuote dloi
     */

    /**
     * Constructs a new DailyQuote.
     * @exports DailyQuote
     * @classdesc Represents a DailyQuote.
     * @implements IDailyQuote
     * @constructor
     * @param {IDailyQuote=} [properties] Properties to set
     */
    function DailyQuote(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DailyQuote do.
     * @member {google.protobuf.IInt64Value|null|undefined} do
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype["do"] = null;

    /**
     * DailyQuote dh.
     * @member {google.protobuf.IInt64Value|null|undefined} dh
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype.dh = null;

    /**
     * DailyQuote dl.
     * @member {google.protobuf.IInt64Value|null|undefined} dl
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype.dl = null;

    /**
     * DailyQuote dc.
     * @member {google.protobuf.IInt64Value|null|undefined} dc
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype.dc = null;

    /**
     * DailyQuote dhoi.
     * @member {google.protobuf.IUInt64Value|null|undefined} dhoi
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype.dhoi = null;

    /**
     * DailyQuote dloi.
     * @member {google.protobuf.IUInt64Value|null|undefined} dloi
     * @memberof DailyQuote
     * @instance
     */
    DailyQuote.prototype.dloi = null;

    /**
     * Creates a new DailyQuote instance using the specified properties.
     * @function create
     * @memberof DailyQuote
     * @static
     * @param {IDailyQuote=} [properties] Properties to set
     * @returns {DailyQuote} DailyQuote instance
     */
    DailyQuote.create = function create(properties) {
        return new DailyQuote(properties);
    };

    /**
     * Encodes the specified DailyQuote message. Does not implicitly {@link DailyQuote.verify|verify} messages.
     * @function encode
     * @memberof DailyQuote
     * @static
     * @param {IDailyQuote} message DailyQuote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DailyQuote.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message["do"] != null && Object.hasOwnProperty.call(message, "do"))
            $root.google.protobuf.Int64Value.encode(message["do"], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.dh != null && Object.hasOwnProperty.call(message, "dh"))
            $root.google.protobuf.Int64Value.encode(message.dh, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.dl != null && Object.hasOwnProperty.call(message, "dl"))
            $root.google.protobuf.Int64Value.encode(message.dl, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.dc != null && Object.hasOwnProperty.call(message, "dc"))
            $root.google.protobuf.Int64Value.encode(message.dc, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.dhoi != null && Object.hasOwnProperty.call(message, "dhoi"))
            $root.google.protobuf.UInt64Value.encode(message.dhoi, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.dloi != null && Object.hasOwnProperty.call(message, "dloi"))
            $root.google.protobuf.UInt64Value.encode(message.dloi, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified DailyQuote message, length delimited. Does not implicitly {@link DailyQuote.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DailyQuote
     * @static
     * @param {IDailyQuote} message DailyQuote message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DailyQuote.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DailyQuote message from the specified reader or buffer.
     * @function decode
     * @memberof DailyQuote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DailyQuote} DailyQuote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DailyQuote.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.DailyQuote();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message["do"] = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.dh = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.dl = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.dc = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 5: {
                    message.dhoi = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.dloi = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DailyQuote message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DailyQuote
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DailyQuote} DailyQuote
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DailyQuote.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DailyQuote message.
     * @function verify
     * @memberof DailyQuote
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DailyQuote.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message["do"] != null && message.hasOwnProperty("do")) {
            var error = $root.google.protobuf.Int64Value.verify(message["do"]);
            if (error)
                return "do." + error;
        }
        if (message.dh != null && message.hasOwnProperty("dh")) {
            var error = $root.google.protobuf.Int64Value.verify(message.dh);
            if (error)
                return "dh." + error;
        }
        if (message.dl != null && message.hasOwnProperty("dl")) {
            var error = $root.google.protobuf.Int64Value.verify(message.dl);
            if (error)
                return "dl." + error;
        }
        if (message.dc != null && message.hasOwnProperty("dc")) {
            var error = $root.google.protobuf.Int64Value.verify(message.dc);
            if (error)
                return "dc." + error;
        }
        if (message.dhoi != null && message.hasOwnProperty("dhoi")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.dhoi);
            if (error)
                return "dhoi." + error;
        }
        if (message.dloi != null && message.hasOwnProperty("dloi")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.dloi);
            if (error)
                return "dloi." + error;
        }
        return null;
    };

    /**
     * Creates a DailyQuote message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DailyQuote
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DailyQuote} DailyQuote
     */
    DailyQuote.fromObject = function fromObject(object) {
        if (object instanceof $root.DailyQuote)
            return object;
        var message = new $root.DailyQuote();
        if (object["do"] != null) {
            if (typeof object["do"] !== "object")
                throw TypeError(".DailyQuote.do: object expected");
            message["do"] = $root.google.protobuf.Int64Value.fromObject(object["do"]);
        }
        if (object.dh != null) {
            if (typeof object.dh !== "object")
                throw TypeError(".DailyQuote.dh: object expected");
            message.dh = $root.google.protobuf.Int64Value.fromObject(object.dh);
        }
        if (object.dl != null) {
            if (typeof object.dl !== "object")
                throw TypeError(".DailyQuote.dl: object expected");
            message.dl = $root.google.protobuf.Int64Value.fromObject(object.dl);
        }
        if (object.dc != null) {
            if (typeof object.dc !== "object")
                throw TypeError(".DailyQuote.dc: object expected");
            message.dc = $root.google.protobuf.Int64Value.fromObject(object.dc);
        }
        if (object.dhoi != null) {
            if (typeof object.dhoi !== "object")
                throw TypeError(".DailyQuote.dhoi: object expected");
            message.dhoi = $root.google.protobuf.UInt64Value.fromObject(object.dhoi);
        }
        if (object.dloi != null) {
            if (typeof object.dloi !== "object")
                throw TypeError(".DailyQuote.dloi: object expected");
            message.dloi = $root.google.protobuf.UInt64Value.fromObject(object.dloi);
        }
        return message;
    };

    /**
     * Creates a plain object from a DailyQuote message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DailyQuote
     * @static
     * @param {DailyQuote} message DailyQuote
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DailyQuote.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object["do"] = null;
            object.dh = null;
            object.dl = null;
            object.dc = null;
            object.dhoi = null;
            object.dloi = null;
        }
        if (message["do"] != null && message.hasOwnProperty("do"))
            object["do"] = $root.google.protobuf.Int64Value.toObject(message["do"], options);
        if (message.dh != null && message.hasOwnProperty("dh"))
            object.dh = $root.google.protobuf.Int64Value.toObject(message.dh, options);
        if (message.dl != null && message.hasOwnProperty("dl"))
            object.dl = $root.google.protobuf.Int64Value.toObject(message.dl, options);
        if (message.dc != null && message.hasOwnProperty("dc"))
            object.dc = $root.google.protobuf.Int64Value.toObject(message.dc, options);
        if (message.dhoi != null && message.hasOwnProperty("dhoi"))
            object.dhoi = $root.google.protobuf.UInt64Value.toObject(message.dhoi, options);
        if (message.dloi != null && message.hasOwnProperty("dloi"))
            object.dloi = $root.google.protobuf.UInt64Value.toObject(message.dloi, options);
        return object;
    };

    /**
     * Converts this DailyQuote to JSON.
     * @function toJSON
     * @memberof DailyQuote
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DailyQuote.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for DailyQuote
     * @function getTypeUrl
     * @memberof DailyQuote
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    DailyQuote.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/DailyQuote";
    };

    return DailyQuote;
})();

$root.OHLCV = (function() {

    /**
     * Properties of a OHLCV.
     * @exports IOHLCV
     * @interface IOHLCV
     * @property {google.protobuf.IInt64Value|null} [open] OHLCV open
     * @property {google.protobuf.IInt64Value|null} [high] OHLCV high
     * @property {google.protobuf.IInt64Value|null} [low] OHLCV low
     * @property {google.protobuf.IInt64Value|null} [close] OHLCV close
     * @property {google.protobuf.IUInt32Value|null} [volume] OHLCV volume
     * @property {google.protobuf.IUInt32Value|null} [epoch] OHLCV epoch
     */

    /**
     * Constructs a new OHLCV.
     * @exports OHLCV
     * @classdesc Represents a OHLCV.
     * @implements IOHLCV
     * @constructor
     * @param {IOHLCV=} [properties] Properties to set
     */
    function OHLCV(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * OHLCV open.
     * @member {google.protobuf.IInt64Value|null|undefined} open
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.open = null;

    /**
     * OHLCV high.
     * @member {google.protobuf.IInt64Value|null|undefined} high
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.high = null;

    /**
     * OHLCV low.
     * @member {google.protobuf.IInt64Value|null|undefined} low
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.low = null;

    /**
     * OHLCV close.
     * @member {google.protobuf.IInt64Value|null|undefined} close
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.close = null;

    /**
     * OHLCV volume.
     * @member {google.protobuf.IUInt32Value|null|undefined} volume
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.volume = null;

    /**
     * OHLCV epoch.
     * @member {google.protobuf.IUInt32Value|null|undefined} epoch
     * @memberof OHLCV
     * @instance
     */
    OHLCV.prototype.epoch = null;

    /**
     * Creates a new OHLCV instance using the specified properties.
     * @function create
     * @memberof OHLCV
     * @static
     * @param {IOHLCV=} [properties] Properties to set
     * @returns {OHLCV} OHLCV instance
     */
    OHLCV.create = function create(properties) {
        return new OHLCV(properties);
    };

    /**
     * Encodes the specified OHLCV message. Does not implicitly {@link OHLCV.verify|verify} messages.
     * @function encode
     * @memberof OHLCV
     * @static
     * @param {IOHLCV} message OHLCV message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    OHLCV.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.open != null && Object.hasOwnProperty.call(message, "open"))
            $root.google.protobuf.Int64Value.encode(message.open, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.high != null && Object.hasOwnProperty.call(message, "high"))
            $root.google.protobuf.Int64Value.encode(message.high, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.low != null && Object.hasOwnProperty.call(message, "low"))
            $root.google.protobuf.Int64Value.encode(message.low, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.close != null && Object.hasOwnProperty.call(message, "close"))
            $root.google.protobuf.Int64Value.encode(message.close, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.volume != null && Object.hasOwnProperty.call(message, "volume"))
            $root.google.protobuf.UInt32Value.encode(message.volume, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.epoch != null && Object.hasOwnProperty.call(message, "epoch"))
            $root.google.protobuf.UInt32Value.encode(message.epoch, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified OHLCV message, length delimited. Does not implicitly {@link OHLCV.verify|verify} messages.
     * @function encodeDelimited
     * @memberof OHLCV
     * @static
     * @param {IOHLCV} message OHLCV message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    OHLCV.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a OHLCV message from the specified reader or buffer.
     * @function decode
     * @memberof OHLCV
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {OHLCV} OHLCV
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    OHLCV.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.OHLCV();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.open = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.high = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.low = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.close = $root.google.protobuf.Int64Value.decode(reader, reader.uint32());
                    break;
                }
            case 5: {
                    message.volume = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.epoch = $root.google.protobuf.UInt32Value.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a OHLCV message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof OHLCV
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {OHLCV} OHLCV
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    OHLCV.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a OHLCV message.
     * @function verify
     * @memberof OHLCV
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    OHLCV.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.open != null && message.hasOwnProperty("open")) {
            var error = $root.google.protobuf.Int64Value.verify(message.open);
            if (error)
                return "open." + error;
        }
        if (message.high != null && message.hasOwnProperty("high")) {
            var error = $root.google.protobuf.Int64Value.verify(message.high);
            if (error)
                return "high." + error;
        }
        if (message.low != null && message.hasOwnProperty("low")) {
            var error = $root.google.protobuf.Int64Value.verify(message.low);
            if (error)
                return "low." + error;
        }
        if (message.close != null && message.hasOwnProperty("close")) {
            var error = $root.google.protobuf.Int64Value.verify(message.close);
            if (error)
                return "close." + error;
        }
        if (message.volume != null && message.hasOwnProperty("volume")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.volume);
            if (error)
                return "volume." + error;
        }
        if (message.epoch != null && message.hasOwnProperty("epoch")) {
            var error = $root.google.protobuf.UInt32Value.verify(message.epoch);
            if (error)
                return "epoch." + error;
        }
        return null;
    };

    /**
     * Creates a OHLCV message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof OHLCV
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {OHLCV} OHLCV
     */
    OHLCV.fromObject = function fromObject(object) {
        if (object instanceof $root.OHLCV)
            return object;
        var message = new $root.OHLCV();
        if (object.open != null) {
            if (typeof object.open !== "object")
                throw TypeError(".OHLCV.open: object expected");
            message.open = $root.google.protobuf.Int64Value.fromObject(object.open);
        }
        if (object.high != null) {
            if (typeof object.high !== "object")
                throw TypeError(".OHLCV.high: object expected");
            message.high = $root.google.protobuf.Int64Value.fromObject(object.high);
        }
        if (object.low != null) {
            if (typeof object.low !== "object")
                throw TypeError(".OHLCV.low: object expected");
            message.low = $root.google.protobuf.Int64Value.fromObject(object.low);
        }
        if (object.close != null) {
            if (typeof object.close !== "object")
                throw TypeError(".OHLCV.close: object expected");
            message.close = $root.google.protobuf.Int64Value.fromObject(object.close);
        }
        if (object.volume != null) {
            if (typeof object.volume !== "object")
                throw TypeError(".OHLCV.volume: object expected");
            message.volume = $root.google.protobuf.UInt32Value.fromObject(object.volume);
        }
        if (object.epoch != null) {
            if (typeof object.epoch !== "object")
                throw TypeError(".OHLCV.epoch: object expected");
            message.epoch = $root.google.protobuf.UInt32Value.fromObject(object.epoch);
        }
        return message;
    };

    /**
     * Creates a plain object from a OHLCV message. Also converts values to other types if specified.
     * @function toObject
     * @memberof OHLCV
     * @static
     * @param {OHLCV} message OHLCV
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    OHLCV.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.open = null;
            object.high = null;
            object.low = null;
            object.close = null;
            object.volume = null;
            object.epoch = null;
        }
        if (message.open != null && message.hasOwnProperty("open"))
            object.open = $root.google.protobuf.Int64Value.toObject(message.open, options);
        if (message.high != null && message.hasOwnProperty("high"))
            object.high = $root.google.protobuf.Int64Value.toObject(message.high, options);
        if (message.low != null && message.hasOwnProperty("low"))
            object.low = $root.google.protobuf.Int64Value.toObject(message.low, options);
        if (message.close != null && message.hasOwnProperty("close"))
            object.close = $root.google.protobuf.Int64Value.toObject(message.close, options);
        if (message.volume != null && message.hasOwnProperty("volume"))
            object.volume = $root.google.protobuf.UInt32Value.toObject(message.volume, options);
        if (message.epoch != null && message.hasOwnProperty("epoch"))
            object.epoch = $root.google.protobuf.UInt32Value.toObject(message.epoch, options);
        return object;
    };

    /**
     * Converts this OHLCV to JSON.
     * @function toJSON
     * @memberof OHLCV
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    OHLCV.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for OHLCV
     * @function getTypeUrl
     * @memberof OHLCV
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    OHLCV.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/OHLCV";
    };

    return OHLCV;
})();

$root.SymDetail = (function() {

    /**
     * Properties of a SymDetail.
     * @exports ISymDetail
     * @interface ISymDetail
     * @property {string|null} [ticksize] SymDetail ticksize
     */

    /**
     * Constructs a new SymDetail.
     * @exports SymDetail
     * @classdesc Represents a SymDetail.
     * @implements ISymDetail
     * @constructor
     * @param {ISymDetail=} [properties] Properties to set
     */
    function SymDetail(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SymDetail ticksize.
     * @member {string} ticksize
     * @memberof SymDetail
     * @instance
     */
    SymDetail.prototype.ticksize = "";

    /**
     * Creates a new SymDetail instance using the specified properties.
     * @function create
     * @memberof SymDetail
     * @static
     * @param {ISymDetail=} [properties] Properties to set
     * @returns {SymDetail} SymDetail instance
     */
    SymDetail.create = function create(properties) {
        return new SymDetail(properties);
    };

    /**
     * Encodes the specified SymDetail message. Does not implicitly {@link SymDetail.verify|verify} messages.
     * @function encode
     * @memberof SymDetail
     * @static
     * @param {ISymDetail} message SymDetail message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SymDetail.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.ticksize != null && Object.hasOwnProperty.call(message, "ticksize"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.ticksize);
        return writer;
    };

    /**
     * Encodes the specified SymDetail message, length delimited. Does not implicitly {@link SymDetail.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SymDetail
     * @static
     * @param {ISymDetail} message SymDetail message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SymDetail.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SymDetail message from the specified reader or buffer.
     * @function decode
     * @memberof SymDetail
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SymDetail} SymDetail
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SymDetail.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SymDetail();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.ticksize = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SymDetail message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SymDetail
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SymDetail} SymDetail
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SymDetail.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SymDetail message.
     * @function verify
     * @memberof SymDetail
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SymDetail.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.ticksize != null && message.hasOwnProperty("ticksize"))
            if (!$util.isString(message.ticksize))
                return "ticksize: string expected";
        return null;
    };

    /**
     * Creates a SymDetail message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SymDetail
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SymDetail} SymDetail
     */
    SymDetail.fromObject = function fromObject(object) {
        if (object instanceof $root.SymDetail)
            return object;
        var message = new $root.SymDetail();
        if (object.ticksize != null)
            message.ticksize = String(object.ticksize);
        return message;
    };

    /**
     * Creates a plain object from a SymDetail message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SymDetail
     * @static
     * @param {SymDetail} message SymDetail
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SymDetail.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults)
            object.ticksize = "";
        if (message.ticksize != null && message.hasOwnProperty("ticksize"))
            object.ticksize = message.ticksize;
        return object;
    };

    /**
     * Converts this SymDetail to JSON.
     * @function toJSON
     * @memberof SymDetail
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SymDetail.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SymDetail
     * @function getTypeUrl
     * @memberof SymDetail
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SymDetail.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SymDetail";
    };

    return SymDetail;
})();

/**
 * MessageType enum.
 * @exports MessageType
 * @enum {number}
 * @property {number} ping=0 ping value
 * @property {number} quote=1 quote value
 * @property {number} extended_quote=2 extended_quote value
 * @property {number} daily_quote=3 daily_quote value
 * @property {number} market_level=4 market_level value
 * @property {number} ohlcv=5 ohlcv value
 * @property {number} depth=6 depth value
 * @property {number} all=7 all value
 * @property {number} response=8 response value
 */
$root.MessageType = (function() {
    var valuesById = {}, values = Object.create(valuesById);
    values[valuesById[0] = "ping"] = 0;
    values[valuesById[1] = "quote"] = 1;
    values[valuesById[2] = "extended_quote"] = 2;
    values[valuesById[3] = "daily_quote"] = 3;
    values[valuesById[4] = "market_level"] = 4;
    values[valuesById[5] = "ohlcv"] = 5;
    values[valuesById[6] = "depth"] = 6;
    values[valuesById[7] = "all"] = 7;
    values[valuesById[8] = "response"] = 8;
    return values;
})();

$root.MarketFeed = (function() {

    /**
     * Properties of a MarketFeed.
     * @exports IMarketFeed
     * @interface IMarketFeed
     * @property {IQuote|null} [quote] MarketFeed quote
     * @property {IExtendedQuote|null} [eq] MarketFeed eq
     * @property {IDailyQuote|null} [dq] MarketFeed dq
     * @property {IOHLCV|null} [ohlcv] MarketFeed ohlcv
     * @property {IDepth|null} [depth] MarketFeed depth
     * @property {google.protobuf.IUInt64Value|null} [feedTime] MarketFeed feedTime
     * @property {google.protobuf.IUInt64Value|null} [sendTime] MarketFeed sendTime
     * @property {string|null} [token] MarketFeed token
     * @property {number|Long|null} [sequenceNo] MarketFeed sequenceNo
     * @property {boolean|null} [snapshot] MarketFeed snapshot
     * @property {string|null} [ticker] MarketFeed ticker
     * @property {ISymDetail|null} [symdetail] MarketFeed symdetail
     */

    /**
     * Constructs a new MarketFeed.
     * @exports MarketFeed
     * @classdesc Represents a MarketFeed.
     * @implements IMarketFeed
     * @constructor
     * @param {IMarketFeed=} [properties] Properties to set
     */
    function MarketFeed(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MarketFeed quote.
     * @member {IQuote|null|undefined} quote
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.quote = null;

    /**
     * MarketFeed eq.
     * @member {IExtendedQuote|null|undefined} eq
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.eq = null;

    /**
     * MarketFeed dq.
     * @member {IDailyQuote|null|undefined} dq
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.dq = null;

    /**
     * MarketFeed ohlcv.
     * @member {IOHLCV|null|undefined} ohlcv
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.ohlcv = null;

    /**
     * MarketFeed depth.
     * @member {IDepth|null|undefined} depth
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.depth = null;

    /**
     * MarketFeed feedTime.
     * @member {google.protobuf.IUInt64Value|null|undefined} feedTime
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.feedTime = null;

    /**
     * MarketFeed sendTime.
     * @member {google.protobuf.IUInt64Value|null|undefined} sendTime
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.sendTime = null;

    /**
     * MarketFeed token.
     * @member {string} token
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.token = "";

    /**
     * MarketFeed sequenceNo.
     * @member {number|Long} sequenceNo
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.sequenceNo = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * MarketFeed snapshot.
     * @member {boolean} snapshot
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.snapshot = false;

    /**
     * MarketFeed ticker.
     * @member {string} ticker
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.ticker = "";

    /**
     * MarketFeed symdetail.
     * @member {ISymDetail|null|undefined} symdetail
     * @memberof MarketFeed
     * @instance
     */
    MarketFeed.prototype.symdetail = null;

    /**
     * Creates a new MarketFeed instance using the specified properties.
     * @function create
     * @memberof MarketFeed
     * @static
     * @param {IMarketFeed=} [properties] Properties to set
     * @returns {MarketFeed} MarketFeed instance
     */
    MarketFeed.create = function create(properties) {
        return new MarketFeed(properties);
    };

    /**
     * Encodes the specified MarketFeed message. Does not implicitly {@link MarketFeed.verify|verify} messages.
     * @function encode
     * @memberof MarketFeed
     * @static
     * @param {IMarketFeed} message MarketFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MarketFeed.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.quote != null && Object.hasOwnProperty.call(message, "quote"))
            $root.Quote.encode(message.quote, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.eq != null && Object.hasOwnProperty.call(message, "eq"))
            $root.ExtendedQuote.encode(message.eq, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.dq != null && Object.hasOwnProperty.call(message, "dq"))
            $root.DailyQuote.encode(message.dq, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.ohlcv != null && Object.hasOwnProperty.call(message, "ohlcv"))
            $root.OHLCV.encode(message.ohlcv, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.depth != null && Object.hasOwnProperty.call(message, "depth"))
            $root.Depth.encode(message.depth, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.feedTime != null && Object.hasOwnProperty.call(message, "feedTime"))
            $root.google.protobuf.UInt64Value.encode(message.feedTime, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.sendTime != null && Object.hasOwnProperty.call(message, "sendTime"))
            $root.google.protobuf.UInt64Value.encode(message.sendTime, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.token != null && Object.hasOwnProperty.call(message, "token"))
            writer.uint32(/* id 8, wireType 2 =*/66).string(message.token);
        if (message.sequenceNo != null && Object.hasOwnProperty.call(message, "sequenceNo"))
            writer.uint32(/* id 9, wireType 0 =*/72).uint64(message.sequenceNo);
        if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
            writer.uint32(/* id 10, wireType 0 =*/80).bool(message.snapshot);
        if (message.ticker != null && Object.hasOwnProperty.call(message, "ticker"))
            writer.uint32(/* id 11, wireType 2 =*/90).string(message.ticker);
        if (message.symdetail != null && Object.hasOwnProperty.call(message, "symdetail"))
            $root.SymDetail.encode(message.symdetail, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MarketFeed message, length delimited. Does not implicitly {@link MarketFeed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MarketFeed
     * @static
     * @param {IMarketFeed} message MarketFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MarketFeed.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MarketFeed message from the specified reader or buffer.
     * @function decode
     * @memberof MarketFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MarketFeed} MarketFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MarketFeed.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MarketFeed();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.quote = $root.Quote.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.eq = $root.ExtendedQuote.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.dq = $root.DailyQuote.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.ohlcv = $root.OHLCV.decode(reader, reader.uint32());
                    break;
                }
            case 5: {
                    message.depth = $root.Depth.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.feedTime = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 7: {
                    message.sendTime = $root.google.protobuf.UInt64Value.decode(reader, reader.uint32());
                    break;
                }
            case 8: {
                    message.token = reader.string();
                    break;
                }
            case 9: {
                    message.sequenceNo = reader.uint64();
                    break;
                }
            case 10: {
                    message.snapshot = reader.bool();
                    break;
                }
            case 11: {
                    message.ticker = reader.string();
                    break;
                }
            case 12: {
                    message.symdetail = $root.SymDetail.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MarketFeed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MarketFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MarketFeed} MarketFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MarketFeed.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MarketFeed message.
     * @function verify
     * @memberof MarketFeed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MarketFeed.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.quote != null && message.hasOwnProperty("quote")) {
            var error = $root.Quote.verify(message.quote);
            if (error)
                return "quote." + error;
        }
        if (message.eq != null && message.hasOwnProperty("eq")) {
            var error = $root.ExtendedQuote.verify(message.eq);
            if (error)
                return "eq." + error;
        }
        if (message.dq != null && message.hasOwnProperty("dq")) {
            var error = $root.DailyQuote.verify(message.dq);
            if (error)
                return "dq." + error;
        }
        if (message.ohlcv != null && message.hasOwnProperty("ohlcv")) {
            var error = $root.OHLCV.verify(message.ohlcv);
            if (error)
                return "ohlcv." + error;
        }
        if (message.depth != null && message.hasOwnProperty("depth")) {
            var error = $root.Depth.verify(message.depth);
            if (error)
                return "depth." + error;
        }
        if (message.feedTime != null && message.hasOwnProperty("feedTime")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.feedTime);
            if (error)
                return "feedTime." + error;
        }
        if (message.sendTime != null && message.hasOwnProperty("sendTime")) {
            var error = $root.google.protobuf.UInt64Value.verify(message.sendTime);
            if (error)
                return "sendTime." + error;
        }
        if (message.token != null && message.hasOwnProperty("token"))
            if (!$util.isString(message.token))
                return "token: string expected";
        if (message.sequenceNo != null && message.hasOwnProperty("sequenceNo"))
            if (!$util.isInteger(message.sequenceNo) && !(message.sequenceNo && $util.isInteger(message.sequenceNo.low) && $util.isInteger(message.sequenceNo.high)))
                return "sequenceNo: integer|Long expected";
        if (message.snapshot != null && message.hasOwnProperty("snapshot"))
            if (typeof message.snapshot !== "boolean")
                return "snapshot: boolean expected";
        if (message.ticker != null && message.hasOwnProperty("ticker"))
            if (!$util.isString(message.ticker))
                return "ticker: string expected";
        if (message.symdetail != null && message.hasOwnProperty("symdetail")) {
            var error = $root.SymDetail.verify(message.symdetail);
            if (error)
                return "symdetail." + error;
        }
        return null;
    };

    /**
     * Creates a MarketFeed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MarketFeed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MarketFeed} MarketFeed
     */
    MarketFeed.fromObject = function fromObject(object) {
        if (object instanceof $root.MarketFeed)
            return object;
        var message = new $root.MarketFeed();
        if (object.quote != null) {
            if (typeof object.quote !== "object")
                throw TypeError(".MarketFeed.quote: object expected");
            message.quote = $root.Quote.fromObject(object.quote);
        }
        if (object.eq != null) {
            if (typeof object.eq !== "object")
                throw TypeError(".MarketFeed.eq: object expected");
            message.eq = $root.ExtendedQuote.fromObject(object.eq);
        }
        if (object.dq != null) {
            if (typeof object.dq !== "object")
                throw TypeError(".MarketFeed.dq: object expected");
            message.dq = $root.DailyQuote.fromObject(object.dq);
        }
        if (object.ohlcv != null) {
            if (typeof object.ohlcv !== "object")
                throw TypeError(".MarketFeed.ohlcv: object expected");
            message.ohlcv = $root.OHLCV.fromObject(object.ohlcv);
        }
        if (object.depth != null) {
            if (typeof object.depth !== "object")
                throw TypeError(".MarketFeed.depth: object expected");
            message.depth = $root.Depth.fromObject(object.depth);
        }
        if (object.feedTime != null) {
            if (typeof object.feedTime !== "object")
                throw TypeError(".MarketFeed.feedTime: object expected");
            message.feedTime = $root.google.protobuf.UInt64Value.fromObject(object.feedTime);
        }
        if (object.sendTime != null) {
            if (typeof object.sendTime !== "object")
                throw TypeError(".MarketFeed.sendTime: object expected");
            message.sendTime = $root.google.protobuf.UInt64Value.fromObject(object.sendTime);
        }
        if (object.token != null)
            message.token = String(object.token);
        if (object.sequenceNo != null)
            if ($util.Long)
                (message.sequenceNo = $util.Long.fromValue(object.sequenceNo)).unsigned = true;
            else if (typeof object.sequenceNo === "string")
                message.sequenceNo = parseInt(object.sequenceNo, 10);
            else if (typeof object.sequenceNo === "number")
                message.sequenceNo = object.sequenceNo;
            else if (typeof object.sequenceNo === "object")
                message.sequenceNo = new $util.LongBits(object.sequenceNo.low >>> 0, object.sequenceNo.high >>> 0).toNumber(true);
        if (object.snapshot != null)
            message.snapshot = Boolean(object.snapshot);
        if (object.ticker != null)
            message.ticker = String(object.ticker);
        if (object.symdetail != null) {
            if (typeof object.symdetail !== "object")
                throw TypeError(".MarketFeed.symdetail: object expected");
            message.symdetail = $root.SymDetail.fromObject(object.symdetail);
        }
        return message;
    };

    /**
     * Creates a plain object from a MarketFeed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MarketFeed
     * @static
     * @param {MarketFeed} message MarketFeed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MarketFeed.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.quote = null;
            object.eq = null;
            object.dq = null;
            object.ohlcv = null;
            object.depth = null;
            object.feedTime = null;
            object.sendTime = null;
            object.token = "";
            if ($util.Long) {
                var long = new $util.Long(0, 0, true);
                object.sequenceNo = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
            } else
                object.sequenceNo = options.longs === String ? "0" : 0;
            object.snapshot = false;
            object.ticker = "";
            object.symdetail = null;
        }
        if (message.quote != null && message.hasOwnProperty("quote"))
            object.quote = $root.Quote.toObject(message.quote, options);
        if (message.eq != null && message.hasOwnProperty("eq"))
            object.eq = $root.ExtendedQuote.toObject(message.eq, options);
        if (message.dq != null && message.hasOwnProperty("dq"))
            object.dq = $root.DailyQuote.toObject(message.dq, options);
        if (message.ohlcv != null && message.hasOwnProperty("ohlcv"))
            object.ohlcv = $root.OHLCV.toObject(message.ohlcv, options);
        if (message.depth != null && message.hasOwnProperty("depth"))
            object.depth = $root.Depth.toObject(message.depth, options);
        if (message.feedTime != null && message.hasOwnProperty("feedTime"))
            object.feedTime = $root.google.protobuf.UInt64Value.toObject(message.feedTime, options);
        if (message.sendTime != null && message.hasOwnProperty("sendTime"))
            object.sendTime = $root.google.protobuf.UInt64Value.toObject(message.sendTime, options);
        if (message.token != null && message.hasOwnProperty("token"))
            object.token = message.token;
        if (message.sequenceNo != null && message.hasOwnProperty("sequenceNo"))
            if (typeof message.sequenceNo === "number")
                object.sequenceNo = options.longs === String ? String(message.sequenceNo) : message.sequenceNo;
            else
                object.sequenceNo = options.longs === String ? $util.Long.prototype.toString.call(message.sequenceNo) : options.longs === Number ? new $util.LongBits(message.sequenceNo.low >>> 0, message.sequenceNo.high >>> 0).toNumber(true) : message.sequenceNo;
        if (message.snapshot != null && message.hasOwnProperty("snapshot"))
            object.snapshot = message.snapshot;
        if (message.ticker != null && message.hasOwnProperty("ticker"))
            object.ticker = message.ticker;
        if (message.symdetail != null && message.hasOwnProperty("symdetail"))
            object.symdetail = $root.SymDetail.toObject(message.symdetail, options);
        return object;
    };

    /**
     * Converts this MarketFeed to JSON.
     * @function toJSON
     * @memberof MarketFeed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MarketFeed.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for MarketFeed
     * @function getTypeUrl
     * @memberof MarketFeed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    MarketFeed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/MarketFeed";
    };

    return MarketFeed;
})();

$root.SocketMessage = (function() {

    /**
     * Properties of a SocketMessage.
     * @exports ISocketMessage
     * @interface ISocketMessage
     * @property {MessageType|null} [type] SocketMessage type
     * @property {Object.<string,IMarketFeed>|null} [feeds] SocketMessage feeds
     * @property {boolean|null} [snapshot] SocketMessage snapshot
     * @property {string|null} [msg] SocketMessage msg
     * @property {boolean|null} [error] SocketMessage error
     */

    /**
     * Constructs a new SocketMessage.
     * @exports SocketMessage
     * @classdesc Represents a SocketMessage.
     * @implements ISocketMessage
     * @constructor
     * @param {ISocketMessage=} [properties] Properties to set
     */
    function SocketMessage(properties) {
        this.feeds = {};
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SocketMessage type.
     * @member {MessageType} type
     * @memberof SocketMessage
     * @instance
     */
    SocketMessage.prototype.type = 0;

    /**
     * SocketMessage feeds.
     * @member {Object.<string,IMarketFeed>} feeds
     * @memberof SocketMessage
     * @instance
     */
    SocketMessage.prototype.feeds = $util.emptyObject;

    /**
     * SocketMessage snapshot.
     * @member {boolean} snapshot
     * @memberof SocketMessage
     * @instance
     */
    SocketMessage.prototype.snapshot = false;

    /**
     * SocketMessage msg.
     * @member {string} msg
     * @memberof SocketMessage
     * @instance
     */
    SocketMessage.prototype.msg = "";

    /**
     * SocketMessage error.
     * @member {boolean} error
     * @memberof SocketMessage
     * @instance
     */
    SocketMessage.prototype.error = false;

    /**
     * Creates a new SocketMessage instance using the specified properties.
     * @function create
     * @memberof SocketMessage
     * @static
     * @param {ISocketMessage=} [properties] Properties to set
     * @returns {SocketMessage} SocketMessage instance
     */
    SocketMessage.create = function create(properties) {
        return new SocketMessage(properties);
    };

    /**
     * Encodes the specified SocketMessage message. Does not implicitly {@link SocketMessage.verify|verify} messages.
     * @function encode
     * @memberof SocketMessage
     * @static
     * @param {ISocketMessage} message SocketMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SocketMessage.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.type != null && Object.hasOwnProperty.call(message, "type"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
        if (message.feeds != null && Object.hasOwnProperty.call(message, "feeds"))
            for (var keys = Object.keys(message.feeds), i = 0; i < keys.length; ++i) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                $root.MarketFeed.encode(message.feeds[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
            }
        if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
            writer.uint32(/* id 3, wireType 0 =*/24).bool(message.snapshot);
        if (message.msg != null && Object.hasOwnProperty.call(message, "msg"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.msg);
        if (message.error != null && Object.hasOwnProperty.call(message, "error"))
            writer.uint32(/* id 5, wireType 0 =*/40).bool(message.error);
        return writer;
    };

    /**
     * Encodes the specified SocketMessage message, length delimited. Does not implicitly {@link SocketMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SocketMessage
     * @static
     * @param {ISocketMessage} message SocketMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SocketMessage.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SocketMessage message from the specified reader or buffer.
     * @function decode
     * @memberof SocketMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SocketMessage} SocketMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SocketMessage.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SocketMessage(), key, value;
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.type = reader.int32();
                    break;
                }
            case 2: {
                    if (message.feeds === $util.emptyObject)
                        message.feeds = {};
                    var end2 = reader.uint32() + reader.pos;
                    key = "";
                    value = null;
                    while (reader.pos < end2) {
                        var tag2 = reader.uint32();
                        switch (tag2 >>> 3) {
                        case 1:
                            key = reader.string();
                            break;
                        case 2:
                            value = $root.MarketFeed.decode(reader, reader.uint32());
                            break;
                        default:
                            reader.skipType(tag2 & 7);
                            break;
                        }
                    }
                    message.feeds[key] = value;
                    break;
                }
            case 3: {
                    message.snapshot = reader.bool();
                    break;
                }
            case 4: {
                    message.msg = reader.string();
                    break;
                }
            case 5: {
                    message.error = reader.bool();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SocketMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SocketMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SocketMessage} SocketMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SocketMessage.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SocketMessage message.
     * @function verify
     * @memberof SocketMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SocketMessage.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.type != null && message.hasOwnProperty("type"))
            switch (message.type) {
            default:
                return "type: enum value expected";
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
                break;
            }
        if (message.feeds != null && message.hasOwnProperty("feeds")) {
            if (!$util.isObject(message.feeds))
                return "feeds: object expected";
            var key = Object.keys(message.feeds);
            for (var i = 0; i < key.length; ++i) {
                var error = $root.MarketFeed.verify(message.feeds[key[i]]);
                if (error)
                    return "feeds." + error;
            }
        }
        if (message.snapshot != null && message.hasOwnProperty("snapshot"))
            if (typeof message.snapshot !== "boolean")
                return "snapshot: boolean expected";
        if (message.msg != null && message.hasOwnProperty("msg"))
            if (!$util.isString(message.msg))
                return "msg: string expected";
        if (message.error != null && message.hasOwnProperty("error"))
            if (typeof message.error !== "boolean")
                return "error: boolean expected";
        return null;
    };

    /**
     * Creates a SocketMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SocketMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SocketMessage} SocketMessage
     */
    SocketMessage.fromObject = function fromObject(object) {
        if (object instanceof $root.SocketMessage)
            return object;
        var message = new $root.SocketMessage();
        switch (object.type) {
        default:
            if (typeof object.type === "number") {
                message.type = object.type;
                break;
            }
            break;
        case "ping":
        case 0:
            message.type = 0;
            break;
        case "quote":
        case 1:
            message.type = 1;
            break;
        case "extended_quote":
        case 2:
            message.type = 2;
            break;
        case "daily_quote":
        case 3:
            message.type = 3;
            break;
        case "market_level":
        case 4:
            message.type = 4;
            break;
        case "ohlcv":
        case 5:
            message.type = 5;
            break;
        case "depth":
        case 6:
            message.type = 6;
            break;
        case "all":
        case 7:
            message.type = 7;
            break;
        case "response":
        case 8:
            message.type = 8;
            break;
        }
        if (object.feeds) {
            if (typeof object.feeds !== "object")
                throw TypeError(".SocketMessage.feeds: object expected");
            message.feeds = {};
            for (var keys = Object.keys(object.feeds), i = 0; i < keys.length; ++i) {
                if (typeof object.feeds[keys[i]] !== "object")
                    throw TypeError(".SocketMessage.feeds: object expected");
                message.feeds[keys[i]] = $root.MarketFeed.fromObject(object.feeds[keys[i]]);
            }
        }
        if (object.snapshot != null)
            message.snapshot = Boolean(object.snapshot);
        if (object.msg != null)
            message.msg = String(object.msg);
        if (object.error != null)
            message.error = Boolean(object.error);
        return message;
    };

    /**
     * Creates a plain object from a SocketMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SocketMessage
     * @static
     * @param {SocketMessage} message SocketMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SocketMessage.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.objects || options.defaults)
            object.feeds = {};
        if (options.defaults) {
            object.type = options.enums === String ? "ping" : 0;
            object.snapshot = false;
            object.msg = "";
            object.error = false;
        }
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = options.enums === String ? $root.MessageType[message.type] === undefined ? message.type : $root.MessageType[message.type] : message.type;
        var keys2;
        if (message.feeds && (keys2 = Object.keys(message.feeds)).length) {
            object.feeds = {};
            for (var j = 0; j < keys2.length; ++j)
                object.feeds[keys2[j]] = $root.MarketFeed.toObject(message.feeds[keys2[j]], options);
        }
        if (message.snapshot != null && message.hasOwnProperty("snapshot"))
            object.snapshot = message.snapshot;
        if (message.msg != null && message.hasOwnProperty("msg"))
            object.msg = message.msg;
        if (message.error != null && message.hasOwnProperty("error"))
            object.error = message.error;
        return object;
    };

    /**
     * Converts this SocketMessage to JSON.
     * @function toJSON
     * @memberof SocketMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SocketMessage.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SocketMessage
     * @function getTypeUrl
     * @memberof SocketMessage
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SocketMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SocketMessage";
    };

    return SocketMessage;
})();

$root.google = (function() {

    /**
     * Namespace google.
     * @exports google
     * @namespace
     */
    var google = {};

    google.protobuf = (function() {

        /**
         * Namespace protobuf.
         * @memberof google
         * @namespace
         */
        var protobuf = {};

        protobuf.DoubleValue = (function() {

            /**
             * Properties of a DoubleValue.
             * @memberof google.protobuf
             * @interface IDoubleValue
             * @property {number|null} [value] DoubleValue value
             */

            /**
             * Constructs a new DoubleValue.
             * @memberof google.protobuf
             * @classdesc Represents a DoubleValue.
             * @implements IDoubleValue
             * @constructor
             * @param {google.protobuf.IDoubleValue=} [properties] Properties to set
             */
            function DoubleValue(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DoubleValue value.
             * @member {number} value
             * @memberof google.protobuf.DoubleValue
             * @instance
             */
            DoubleValue.prototype.value = 0;

            /**
             * Creates a new DoubleValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {google.protobuf.IDoubleValue=} [properties] Properties to set
             * @returns {google.protobuf.DoubleValue} DoubleValue instance
             */
            DoubleValue.create = function create(properties) {
                return new DoubleValue(properties);
            };

            /**
             * Encodes the specified DoubleValue message. Does not implicitly {@link google.protobuf.DoubleValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {google.protobuf.IDoubleValue} message DoubleValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DoubleValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 1 =*/9).double(message.value);
                return writer;
            };

            /**
             * Encodes the specified DoubleValue message, length delimited. Does not implicitly {@link google.protobuf.DoubleValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {google.protobuf.IDoubleValue} message DoubleValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DoubleValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a DoubleValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.DoubleValue} DoubleValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DoubleValue.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.DoubleValue();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.double();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a DoubleValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.DoubleValue} DoubleValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DoubleValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DoubleValue message.
             * @function verify
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DoubleValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (typeof message.value !== "number")
                        return "value: number expected";
                return null;
            };

            /**
             * Creates a DoubleValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.DoubleValue} DoubleValue
             */
            DoubleValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.DoubleValue)
                    return object;
                var message = new $root.google.protobuf.DoubleValue();
                if (object.value != null)
                    message.value = Number(object.value);
                return message;
            };

            /**
             * Creates a plain object from a DoubleValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {google.protobuf.DoubleValue} message DoubleValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DoubleValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
                return object;
            };

            /**
             * Converts this DoubleValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.DoubleValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DoubleValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DoubleValue
             * @function getTypeUrl
             * @memberof google.protobuf.DoubleValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DoubleValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.DoubleValue";
            };

            return DoubleValue;
        })();

        protobuf.FloatValue = (function() {

            /**
             * Properties of a FloatValue.
             * @memberof google.protobuf
             * @interface IFloatValue
             * @property {number|null} [value] FloatValue value
             */

            /**
             * Constructs a new FloatValue.
             * @memberof google.protobuf
             * @classdesc Represents a FloatValue.
             * @implements IFloatValue
             * @constructor
             * @param {google.protobuf.IFloatValue=} [properties] Properties to set
             */
            function FloatValue(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * FloatValue value.
             * @member {number} value
             * @memberof google.protobuf.FloatValue
             * @instance
             */
            FloatValue.prototype.value = 0;

            /**
             * Creates a new FloatValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {google.protobuf.IFloatValue=} [properties] Properties to set
             * @returns {google.protobuf.FloatValue} FloatValue instance
             */
            FloatValue.create = function create(properties) {
                return new FloatValue(properties);
            };

            /**
             * Encodes the specified FloatValue message. Does not implicitly {@link google.protobuf.FloatValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {google.protobuf.IFloatValue} message FloatValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            FloatValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 5 =*/13).float(message.value);
                return writer;
            };

            /**
             * Encodes the specified FloatValue message, length delimited. Does not implicitly {@link google.protobuf.FloatValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {google.protobuf.IFloatValue} message FloatValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            FloatValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a FloatValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.FloatValue} FloatValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            FloatValue.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.FloatValue();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.float();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a FloatValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.FloatValue} FloatValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            FloatValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a FloatValue message.
             * @function verify
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            FloatValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (typeof message.value !== "number")
                        return "value: number expected";
                return null;
            };

            /**
             * Creates a FloatValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.FloatValue} FloatValue
             */
            FloatValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.FloatValue)
                    return object;
                var message = new $root.google.protobuf.FloatValue();
                if (object.value != null)
                    message.value = Number(object.value);
                return message;
            };

            /**
             * Creates a plain object from a FloatValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {google.protobuf.FloatValue} message FloatValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            FloatValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
                return object;
            };

            /**
             * Converts this FloatValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.FloatValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            FloatValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for FloatValue
             * @function getTypeUrl
             * @memberof google.protobuf.FloatValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            FloatValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.FloatValue";
            };

            return FloatValue;
        })();

        protobuf.Int64Value = (function() {

            /**
             * Properties of an Int64Value.
             * @memberof google.protobuf
             * @interface IInt64Value
             * @property {number|Long|null} [value] Int64Value value
             */

            /**
             * Constructs a new Int64Value.
             * @memberof google.protobuf
             * @classdesc Represents an Int64Value.
             * @implements IInt64Value
             * @constructor
             * @param {google.protobuf.IInt64Value=} [properties] Properties to set
             */
            function Int64Value(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Int64Value value.
             * @member {number|Long} value
             * @memberof google.protobuf.Int64Value
             * @instance
             */
            Int64Value.prototype.value = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

            /**
             * Creates a new Int64Value instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {google.protobuf.IInt64Value=} [properties] Properties to set
             * @returns {google.protobuf.Int64Value} Int64Value instance
             */
            Int64Value.create = function create(properties) {
                return new Int64Value(properties);
            };

            /**
             * Encodes the specified Int64Value message. Does not implicitly {@link google.protobuf.Int64Value.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {google.protobuf.IInt64Value} message Int64Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Int64Value.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int64(message.value);
                return writer;
            };

            /**
             * Encodes the specified Int64Value message, length delimited. Does not implicitly {@link google.protobuf.Int64Value.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {google.protobuf.IInt64Value} message Int64Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Int64Value.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Int64Value message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Int64Value} Int64Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Int64Value.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Int64Value();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.int64();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Int64Value message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Int64Value} Int64Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Int64Value.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Int64Value message.
             * @function verify
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Int64Value.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isInteger(message.value) && !(message.value && $util.isInteger(message.value.low) && $util.isInteger(message.value.high)))
                        return "value: integer|Long expected";
                return null;
            };

            /**
             * Creates an Int64Value message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Int64Value} Int64Value
             */
            Int64Value.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Int64Value)
                    return object;
                var message = new $root.google.protobuf.Int64Value();
                if (object.value != null)
                    if ($util.Long)
                        (message.value = $util.Long.fromValue(object.value)).unsigned = false;
                    else if (typeof object.value === "string")
                        message.value = parseInt(object.value, 10);
                    else if (typeof object.value === "number")
                        message.value = object.value;
                    else if (typeof object.value === "object")
                        message.value = new $util.LongBits(object.value.low >>> 0, object.value.high >>> 0).toNumber();
                return message;
            };

            /**
             * Creates a plain object from an Int64Value message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {google.protobuf.Int64Value} message Int64Value
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Int64Value.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    if ($util.Long) {
                        var long = new $util.Long(0, 0, false);
                        object.value = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.value = options.longs === String ? "0" : 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    if (typeof message.value === "number")
                        object.value = options.longs === String ? String(message.value) : message.value;
                    else
                        object.value = options.longs === String ? $util.Long.prototype.toString.call(message.value) : options.longs === Number ? new $util.LongBits(message.value.low >>> 0, message.value.high >>> 0).toNumber() : message.value;
                return object;
            };

            /**
             * Converts this Int64Value to JSON.
             * @function toJSON
             * @memberof google.protobuf.Int64Value
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Int64Value.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Int64Value
             * @function getTypeUrl
             * @memberof google.protobuf.Int64Value
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Int64Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.Int64Value";
            };

            return Int64Value;
        })();

        protobuf.UInt64Value = (function() {

            /**
             * Properties of a UInt64Value.
             * @memberof google.protobuf
             * @interface IUInt64Value
             * @property {number|Long|null} [value] UInt64Value value
             */

            /**
             * Constructs a new UInt64Value.
             * @memberof google.protobuf
             * @classdesc Represents a UInt64Value.
             * @implements IUInt64Value
             * @constructor
             * @param {google.protobuf.IUInt64Value=} [properties] Properties to set
             */
            function UInt64Value(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * UInt64Value value.
             * @member {number|Long} value
             * @memberof google.protobuf.UInt64Value
             * @instance
             */
            UInt64Value.prototype.value = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * Creates a new UInt64Value instance using the specified properties.
             * @function create
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {google.protobuf.IUInt64Value=} [properties] Properties to set
             * @returns {google.protobuf.UInt64Value} UInt64Value instance
             */
            UInt64Value.create = function create(properties) {
                return new UInt64Value(properties);
            };

            /**
             * Encodes the specified UInt64Value message. Does not implicitly {@link google.protobuf.UInt64Value.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {google.protobuf.IUInt64Value} message UInt64Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            UInt64Value.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.value);
                return writer;
            };

            /**
             * Encodes the specified UInt64Value message, length delimited. Does not implicitly {@link google.protobuf.UInt64Value.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {google.protobuf.IUInt64Value} message UInt64Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            UInt64Value.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a UInt64Value message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.UInt64Value} UInt64Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            UInt64Value.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.UInt64Value();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.uint64();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a UInt64Value message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.UInt64Value} UInt64Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            UInt64Value.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a UInt64Value message.
             * @function verify
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            UInt64Value.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isInteger(message.value) && !(message.value && $util.isInteger(message.value.low) && $util.isInteger(message.value.high)))
                        return "value: integer|Long expected";
                return null;
            };

            /**
             * Creates a UInt64Value message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.UInt64Value} UInt64Value
             */
            UInt64Value.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.UInt64Value)
                    return object;
                var message = new $root.google.protobuf.UInt64Value();
                if (object.value != null)
                    if ($util.Long)
                        (message.value = $util.Long.fromValue(object.value)).unsigned = true;
                    else if (typeof object.value === "string")
                        message.value = parseInt(object.value, 10);
                    else if (typeof object.value === "number")
                        message.value = object.value;
                    else if (typeof object.value === "object")
                        message.value = new $util.LongBits(object.value.low >>> 0, object.value.high >>> 0).toNumber(true);
                return message;
            };

            /**
             * Creates a plain object from a UInt64Value message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {google.protobuf.UInt64Value} message UInt64Value
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            UInt64Value.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    if ($util.Long) {
                        var long = new $util.Long(0, 0, true);
                        object.value = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.value = options.longs === String ? "0" : 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    if (typeof message.value === "number")
                        object.value = options.longs === String ? String(message.value) : message.value;
                    else
                        object.value = options.longs === String ? $util.Long.prototype.toString.call(message.value) : options.longs === Number ? new $util.LongBits(message.value.low >>> 0, message.value.high >>> 0).toNumber(true) : message.value;
                return object;
            };

            /**
             * Converts this UInt64Value to JSON.
             * @function toJSON
             * @memberof google.protobuf.UInt64Value
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            UInt64Value.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for UInt64Value
             * @function getTypeUrl
             * @memberof google.protobuf.UInt64Value
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            UInt64Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.UInt64Value";
            };

            return UInt64Value;
        })();

        protobuf.Int32Value = (function() {

            /**
             * Properties of an Int32Value.
             * @memberof google.protobuf
             * @interface IInt32Value
             * @property {number|null} [value] Int32Value value
             */

            /**
             * Constructs a new Int32Value.
             * @memberof google.protobuf
             * @classdesc Represents an Int32Value.
             * @implements IInt32Value
             * @constructor
             * @param {google.protobuf.IInt32Value=} [properties] Properties to set
             */
            function Int32Value(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Int32Value value.
             * @member {number} value
             * @memberof google.protobuf.Int32Value
             * @instance
             */
            Int32Value.prototype.value = 0;

            /**
             * Creates a new Int32Value instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {google.protobuf.IInt32Value=} [properties] Properties to set
             * @returns {google.protobuf.Int32Value} Int32Value instance
             */
            Int32Value.create = function create(properties) {
                return new Int32Value(properties);
            };

            /**
             * Encodes the specified Int32Value message. Does not implicitly {@link google.protobuf.Int32Value.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {google.protobuf.IInt32Value} message Int32Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Int32Value.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                return writer;
            };

            /**
             * Encodes the specified Int32Value message, length delimited. Does not implicitly {@link google.protobuf.Int32Value.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {google.protobuf.IInt32Value} message Int32Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Int32Value.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Int32Value message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Int32Value} Int32Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Int32Value.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Int32Value();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Int32Value message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Int32Value} Int32Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Int32Value.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Int32Value message.
             * @function verify
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Int32Value.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isInteger(message.value))
                        return "value: integer expected";
                return null;
            };

            /**
             * Creates an Int32Value message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Int32Value} Int32Value
             */
            Int32Value.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Int32Value)
                    return object;
                var message = new $root.google.protobuf.Int32Value();
                if (object.value != null)
                    message.value = object.value | 0;
                return message;
            };

            /**
             * Creates a plain object from an Int32Value message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {google.protobuf.Int32Value} message Int32Value
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Int32Value.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                return object;
            };

            /**
             * Converts this Int32Value to JSON.
             * @function toJSON
             * @memberof google.protobuf.Int32Value
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Int32Value.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Int32Value
             * @function getTypeUrl
             * @memberof google.protobuf.Int32Value
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Int32Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.Int32Value";
            };

            return Int32Value;
        })();

        protobuf.UInt32Value = (function() {

            /**
             * Properties of a UInt32Value.
             * @memberof google.protobuf
             * @interface IUInt32Value
             * @property {number|null} [value] UInt32Value value
             */

            /**
             * Constructs a new UInt32Value.
             * @memberof google.protobuf
             * @classdesc Represents a UInt32Value.
             * @implements IUInt32Value
             * @constructor
             * @param {google.protobuf.IUInt32Value=} [properties] Properties to set
             */
            function UInt32Value(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * UInt32Value value.
             * @member {number} value
             * @memberof google.protobuf.UInt32Value
             * @instance
             */
            UInt32Value.prototype.value = 0;

            /**
             * Creates a new UInt32Value instance using the specified properties.
             * @function create
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {google.protobuf.IUInt32Value=} [properties] Properties to set
             * @returns {google.protobuf.UInt32Value} UInt32Value instance
             */
            UInt32Value.create = function create(properties) {
                return new UInt32Value(properties);
            };

            /**
             * Encodes the specified UInt32Value message. Does not implicitly {@link google.protobuf.UInt32Value.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {google.protobuf.IUInt32Value} message UInt32Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            UInt32Value.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.value);
                return writer;
            };

            /**
             * Encodes the specified UInt32Value message, length delimited. Does not implicitly {@link google.protobuf.UInt32Value.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {google.protobuf.IUInt32Value} message UInt32Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            UInt32Value.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a UInt32Value message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.UInt32Value} UInt32Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            UInt32Value.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.UInt32Value();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.uint32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a UInt32Value message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.UInt32Value} UInt32Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            UInt32Value.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a UInt32Value message.
             * @function verify
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            UInt32Value.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isInteger(message.value))
                        return "value: integer expected";
                return null;
            };

            /**
             * Creates a UInt32Value message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.UInt32Value} UInt32Value
             */
            UInt32Value.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.UInt32Value)
                    return object;
                var message = new $root.google.protobuf.UInt32Value();
                if (object.value != null)
                    message.value = object.value >>> 0;
                return message;
            };

            /**
             * Creates a plain object from a UInt32Value message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {google.protobuf.UInt32Value} message UInt32Value
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            UInt32Value.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = 0;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                return object;
            };

            /**
             * Converts this UInt32Value to JSON.
             * @function toJSON
             * @memberof google.protobuf.UInt32Value
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            UInt32Value.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for UInt32Value
             * @function getTypeUrl
             * @memberof google.protobuf.UInt32Value
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            UInt32Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.UInt32Value";
            };

            return UInt32Value;
        })();

        protobuf.BoolValue = (function() {

            /**
             * Properties of a BoolValue.
             * @memberof google.protobuf
             * @interface IBoolValue
             * @property {boolean|null} [value] BoolValue value
             */

            /**
             * Constructs a new BoolValue.
             * @memberof google.protobuf
             * @classdesc Represents a BoolValue.
             * @implements IBoolValue
             * @constructor
             * @param {google.protobuf.IBoolValue=} [properties] Properties to set
             */
            function BoolValue(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * BoolValue value.
             * @member {boolean} value
             * @memberof google.protobuf.BoolValue
             * @instance
             */
            BoolValue.prototype.value = false;

            /**
             * Creates a new BoolValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {google.protobuf.IBoolValue=} [properties] Properties to set
             * @returns {google.protobuf.BoolValue} BoolValue instance
             */
            BoolValue.create = function create(properties) {
                return new BoolValue(properties);
            };

            /**
             * Encodes the specified BoolValue message. Does not implicitly {@link google.protobuf.BoolValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {google.protobuf.IBoolValue} message BoolValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BoolValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 0 =*/8).bool(message.value);
                return writer;
            };

            /**
             * Encodes the specified BoolValue message, length delimited. Does not implicitly {@link google.protobuf.BoolValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {google.protobuf.IBoolValue} message BoolValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BoolValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a BoolValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.BoolValue} BoolValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BoolValue.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.BoolValue();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.bool();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a BoolValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.BoolValue} BoolValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BoolValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a BoolValue message.
             * @function verify
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            BoolValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (typeof message.value !== "boolean")
                        return "value: boolean expected";
                return null;
            };

            /**
             * Creates a BoolValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.BoolValue} BoolValue
             */
            BoolValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.BoolValue)
                    return object;
                var message = new $root.google.protobuf.BoolValue();
                if (object.value != null)
                    message.value = Boolean(object.value);
                return message;
            };

            /**
             * Creates a plain object from a BoolValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {google.protobuf.BoolValue} message BoolValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            BoolValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = false;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                return object;
            };

            /**
             * Converts this BoolValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.BoolValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            BoolValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for BoolValue
             * @function getTypeUrl
             * @memberof google.protobuf.BoolValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            BoolValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.BoolValue";
            };

            return BoolValue;
        })();

        protobuf.StringValue = (function() {

            /**
             * Properties of a StringValue.
             * @memberof google.protobuf
             * @interface IStringValue
             * @property {string|null} [value] StringValue value
             */

            /**
             * Constructs a new StringValue.
             * @memberof google.protobuf
             * @classdesc Represents a StringValue.
             * @implements IStringValue
             * @constructor
             * @param {google.protobuf.IStringValue=} [properties] Properties to set
             */
            function StringValue(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * StringValue value.
             * @member {string} value
             * @memberof google.protobuf.StringValue
             * @instance
             */
            StringValue.prototype.value = "";

            /**
             * Creates a new StringValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.StringValue
             * @static
             * @param {google.protobuf.IStringValue=} [properties] Properties to set
             * @returns {google.protobuf.StringValue} StringValue instance
             */
            StringValue.create = function create(properties) {
                return new StringValue(properties);
            };

            /**
             * Encodes the specified StringValue message. Does not implicitly {@link google.protobuf.StringValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.StringValue
             * @static
             * @param {google.protobuf.IStringValue} message StringValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StringValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.value);
                return writer;
            };

            /**
             * Encodes the specified StringValue message, length delimited. Does not implicitly {@link google.protobuf.StringValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.StringValue
             * @static
             * @param {google.protobuf.IStringValue} message StringValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StringValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a StringValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.StringValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.StringValue} StringValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StringValue.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.StringValue();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a StringValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.StringValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.StringValue} StringValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StringValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a StringValue message.
             * @function verify
             * @memberof google.protobuf.StringValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            StringValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isString(message.value))
                        return "value: string expected";
                return null;
            };

            /**
             * Creates a StringValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.StringValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.StringValue} StringValue
             */
            StringValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.StringValue)
                    return object;
                var message = new $root.google.protobuf.StringValue();
                if (object.value != null)
                    message.value = String(object.value);
                return message;
            };

            /**
             * Creates a plain object from a StringValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.StringValue
             * @static
             * @param {google.protobuf.StringValue} message StringValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            StringValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    object.value = "";
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                return object;
            };

            /**
             * Converts this StringValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.StringValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            StringValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for StringValue
             * @function getTypeUrl
             * @memberof google.protobuf.StringValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            StringValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.StringValue";
            };

            return StringValue;
        })();

        protobuf.BytesValue = (function() {

            /**
             * Properties of a BytesValue.
             * @memberof google.protobuf
             * @interface IBytesValue
             * @property {Uint8Array|null} [value] BytesValue value
             */

            /**
             * Constructs a new BytesValue.
             * @memberof google.protobuf
             * @classdesc Represents a BytesValue.
             * @implements IBytesValue
             * @constructor
             * @param {google.protobuf.IBytesValue=} [properties] Properties to set
             */
            function BytesValue(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * BytesValue value.
             * @member {Uint8Array} value
             * @memberof google.protobuf.BytesValue
             * @instance
             */
            BytesValue.prototype.value = $util.newBuffer([]);

            /**
             * Creates a new BytesValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {google.protobuf.IBytesValue=} [properties] Properties to set
             * @returns {google.protobuf.BytesValue} BytesValue instance
             */
            BytesValue.create = function create(properties) {
                return new BytesValue(properties);
            };

            /**
             * Encodes the specified BytesValue message. Does not implicitly {@link google.protobuf.BytesValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {google.protobuf.IBytesValue} message BytesValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BytesValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.value);
                return writer;
            };

            /**
             * Encodes the specified BytesValue message, length delimited. Does not implicitly {@link google.protobuf.BytesValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {google.protobuf.IBytesValue} message BytesValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BytesValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a BytesValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.BytesValue} BytesValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BytesValue.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.BytesValue();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1: {
                            message.value = reader.bytes();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a BytesValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.BytesValue} BytesValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BytesValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a BytesValue message.
             * @function verify
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            BytesValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!(message.value && typeof message.value.length === "number" || $util.isString(message.value)))
                        return "value: buffer expected";
                return null;
            };

            /**
             * Creates a BytesValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.BytesValue} BytesValue
             */
            BytesValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.BytesValue)
                    return object;
                var message = new $root.google.protobuf.BytesValue();
                if (object.value != null)
                    if (typeof object.value === "string")
                        $util.base64.decode(object.value, message.value = $util.newBuffer($util.base64.length(object.value)), 0);
                    else if (object.value.length >= 0)
                        message.value = object.value;
                return message;
            };

            /**
             * Creates a plain object from a BytesValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {google.protobuf.BytesValue} message BytesValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            BytesValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults)
                    if (options.bytes === String)
                        object.value = "";
                    else {
                        object.value = [];
                        if (options.bytes !== Array)
                            object.value = $util.newBuffer(object.value);
                    }
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = options.bytes === String ? $util.base64.encode(message.value, 0, message.value.length) : options.bytes === Array ? Array.prototype.slice.call(message.value) : message.value;
                return object;
            };

            /**
             * Converts this BytesValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.BytesValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            BytesValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for BytesValue
             * @function getTypeUrl
             * @memberof google.protobuf.BytesValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            BytesValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.BytesValue";
            };

            return BytesValue;
        })();

        return protobuf;
    })();

    return google;
})();

module.exports = $root;
