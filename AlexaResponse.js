'use strict';

let uuid = require('uuid');

/**
 * Helper class to generate an AlexaResponse.
 * @class
 */
class AlexaResponse {

    /**
     * Check a value for validity or return a default.
     * @param value The value being checked
     * @param defaultValue A default value if the passed value is not valid
     * @returns {*} The passed value if valid otherwise the default value.
     */
    checkValue(value, defaultValue) {

        if (value === undefined || value === {} || value === "")
            return defaultValue;

        return value;
    }

    /**
     * Constructor for an Alexa Response.
     * @constructor
     * @param opts Contains initialization options for the response
     */
    constructor(opts) {

        if (opts === undefined)
            opts = {};

        if (opts.context !== undefined)
            this.context = this.checkValue(opts.context, undefined);

        if (opts.event !== undefined)
            this.event = this.checkValue(opts.event, undefined);
        else
            this.event = {
            "header": {
                "namespace": this.checkValue(opts.namespace, "Alexa"),
                "name": this.checkValue(opts.name, "Response"),
                "messageId": this.checkValue(opts.messageId, uuid()),
                "correlationToken": this.checkValue(opts.correlationToken, undefined),
                "payloadVersion": this.checkValue(opts.payloadVersion, "3")
            },
            "endpoint": {
                "scope": {
                    "type": "BearerToken",
                    "token": this.checkValue(opts.token, "INVALID"),
                },
                "cookie": this.checkValue(opts.cookie, {}),
                "endpointId": this.checkValue(opts.endpointId, "INVALID")
            },
            "payload": this.checkValue(opts.payload, {})
        };

        // No endpoint in an AcceptGrant or Discover request
        if (this.event.header.name === "AcceptGrant.Response" || this.event.header.name === "Discover.Response" )
            delete this.event.endpoint;
            
        if (this.event.header.name === "StateReport") 
            delete this.event.endpoint.scope;

    }

    /**
     * Add a property to the context.
     * @param opts Contains options for the property.
     */
    addContextProperty(opts) {

        if (this.context === undefined)
            this.context = {properties: []};

        this.context.properties.push(this.createContextProperty(opts));
    }

    /**
     * Add an endpoint to the payload.
     * @param opts Contains options for the endpoint.
     */
    addPayloadEndpoint(opts) {

        if (this.event.payload.endpoints === undefined)
            this.event.payload.endpoints = [];

        this.event.payload.endpoints.push(this.createPayloadEndpoint(opts));
    }

    /**
     * Creates a property for the context.
     * @param opts Contains options for the property.
     */
    createContextProperty(opts) {
        return {
            'namespace': this.checkValue(opts.namespace, "Alexa.EndpointHealth"),
            'name': this.checkValue(opts.name, "connectivity"),
            'value': this.checkValue(opts.value, {"value": "OK"}),
            'timeOfSample': new Date().toISOString(),
            'uncertaintyInMilliseconds': this.checkValue(opts.uncertaintyInMilliseconds, 0)
        };
    }

    /**
     * Creates an endpoint for the payload.
     * @param opts Contains options for the endpoint.
     */
    createPayloadEndpoint(opts) {

        if (opts === undefined) opts = {};

        // Return the proper structure expected for the endpoint
        let endpoint =
            {
                "capabilities": this.checkValue(opts.capabilities, []),
                "description": this.checkValue(opts.description, "Control Roku TV with Alexa"),
                "displayCategories": this.checkValue(opts.displayCategories, ["OTHER"]),
                "endpointId": this.checkValue(opts.endpointId, 'endpoint-001'),
                // "endpointId": this.checkValue(opts.endpointId, 'endpoint_' + (Math.floor(Math.random() * 90000) + 10000)),
                "friendlyName": this.checkValue(opts.friendlyName, "TV"),
                "manufacturerName": this.checkValue(opts.manufacturerName, "Roku"),
                "displayCategories": this.checkValue(opts.displayCategories, ["TV"])
            };

        if (opts.hasOwnProperty("cookie"))
            endpoint["cookie"] = this.checkValue('cookie', {});

        return endpoint
    }

    /**
     * Creates a capability for an endpoint within the payload.
     * @param opts Contains options for the endpoint capability.
     */
    createPayloadEndpointCapability(opts) {

        if (opts === undefined) opts = {};

        let capability = {};
        capability['type'] = this.checkValue(opts.type, "AlexaInterface");
        capability['interface'] = this.checkValue(opts.interface, "Alexa");
        capability['version'] = this.checkValue(opts.version, "3");
        capability['inputs'] = this.checkValue(opts.inputs, []);
        let supported = this.checkValue(opts.supported, false);
        if (supported) {
            capability['properties'] = {};
            capability['properties']['supported'] = supported;
            capability['properties']['proactivelyReported'] = this.checkValue(opts.proactivelyReported, true);
            capability['properties']['retrievable'] = this.checkValue(opts.retrievable, true);
        }
        let supportedOperations = this.checkValue(opts.supportedOperations, false);
        if (supportedOperations) {
            capability['properties'] = {};
            capability['supportedOperations'] = supportedOperations;
        }
        let supportedIntents = this.checkValue(opts.supportedIntents, false);
        if (supportedIntents) {
            capability['supportedIntents'] = supportedIntents;
        }
        let proactivelyReported = this.checkValue(opts.proactivelyReported, false);
        if (proactivelyReported) {
            capability['proactivelyReported'] = proactivelyReported;
        }
        
        
        return capability
    }

    /**
     * Get the composed Alexa Response.
     * @returns {AlexaResponse}
     */
    get() {
        return this;
    }
}

module.exports = AlexaResponse;