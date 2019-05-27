'use strict';

const doc = require('dynamodb-doc');
const dynamo = new doc.DynamoDB();
const AlexaResponse = require("./AlexaResponse");
const Wyze = require('wyze-node');

const phoneId = process.env.PHONEID;

const options = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    phoneId: phoneId
  }

const wyze = new Wyze(options);

exports.handler = async function (event, context) {

    console.log("index.handler request  -----");
    console.log(JSON.stringify(event));

    if (context !== undefined) {
        console.log("index.handler context  -----");
        console.log(JSON.stringify(context));
    }

    // Validate we have an Alexa directive
    if (!('directive' in event)) {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive, Is request a valid Alexa directive?"
                }
            });
        return sendResponse(aer.get());
    }

    // Check the payload version
    if (event.directive.header.payloadVersion !== "3") {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            });
        return sendResponse(aer.get());
    }

    let namespace = ((event.directive || {}).header || {}).namespace;
    
    
    
    // Save token!
    if (namespace.toLowerCase() === 'alexa.authorization') {
        let token = event.directive.payload.grantee.token;
        console.log("******TOKEN***********", token);

        let aar = new AlexaResponse({"namespace": "Alexa.Authorization", "name": "AcceptGrant.Response",});
        return sendResponse(aar.get());
    }

    if (namespace.toLowerCase() === 'alexa.discovery') {
        let adr = new AlexaResponse({"namespace": "Alexa.Discovery", "name": "Discover.Response"});
        let capability_alexa = adr.createPayloadEndpointCapability();
        let capability_alexa_endpointhealth = adr.createPayloadEndpointCapability({"interface": "Alexa.EndpointHealth", "supported": [{"name": "connectivity"}]});
        let capability_alexa_contactsensor = adr.createPayloadEndpointCapability({"interface": "Alexa.ContactSensor", "supported": [{"name": "detectionState"}]});

        // Get list of devices from API
        const devices = await getDevices();
        await devices.forEach((device) => {
            let endpointId = `${device.nickname.replace(/\s/g, '').toLowerCase()}-01`;
            adr.addPayloadEndpoint({"friendlyName": device.nickname, "endpointId": endpointId, "description": `Check the ${device.nickname.toLowerCase()} status`,"manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});
        })

        // Add devices manually
        // adr.addPayloadEndpoint({"friendlyName": "Front door", "endpointId": "frontdoor-01", "description": "Check the front door status","manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});
        // adr.addPayloadEndpoint({"friendlyName": "Deck door", "endpointId": "deckdoor-01", "description": "Check the deck door status","manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});
        // adr.addPayloadEndpoint({"friendlyName": "Garage door", "endpointId": "garagedoor-01", "description": "Check the garage door status","manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});
        // adr.addPayloadEndpoint({"friendlyName": "Back door", "endpointId": "backdoor-01", "description": "Check the back door status","manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});
        // adr.addPayloadEndpoint({"friendlyName": "Basement door", "endpointId": "basementdoor-01", "description": "Check the basement door status","manufacturerName":"Wyze", "displayCategories":["CONTACT_SENSOR"], "capabilities": [capability_alexa, capability_alexa_contactsensor, capability_alexa_endpointhealth]});


        return sendResponse(adr.get());
    }

    if (namespace.toLowerCase() === 'alexa' && event.directive.header.name === 'ReportState' ) {
        
        let endpoint_id = event.directive.endpoint.endpointId;
        let token = event.directive.endpoint.scope.token;
        let correlationToken = event.directive.header.correlationToken;
        
        let lock_state_value = "NOT_DETECTED";

        let ar = new AlexaResponse(
            {
                "correlationToken": correlationToken,
                "token": token,
                "endpointId": endpoint_id,
                "name": "StateReport"
            }
        );
        
        // const statusResponse = await getStatus(endpoint_id);
        // lock_state_value = statusResponse.Item.status == 'closed' ? 'NOT_DETECTED' : 'DETECTED';
        const statusResponse = await getStatusFromApi(endpoint_id);
        lock_state_value = statusResponse['device_params']['open_close_state'] == 0 ? 'NOT_DETECTED' : 'DETECTED';

        ar.addContextProperty({"namespace":"Alexa.ContactSensor", "name": "detectionState", "value": lock_state_value});
        ar.addContextProperty({"namespace":"Alexa.EndpointHealth", "name": "connectivity", "value": {"value": "OK"}});
        return sendResponse(ar.get());
    }    
    
};

function sendResponse(response) {
    // TODO Validate the response
    console.log("index.handler response -----");
    console.log(JSON.stringify(response));
    return response;
}

async function getStatus(endpointId) {
    const params = {
      TableName: 'WYZE',
      Key: {
        "id": endpointId
      }
    };
    const result = await dynamo.getItem(params).promise();
    return result;
}

async function getDevices() {

    let devices = [];

    // Get tokens from DB
    let tokens = await getTokens();
    let accessToken = tokens.Item.accessToken;
    let refreshToken = tokens.Item.refreshToken;
    await wyze.setTokens(accessToken, refreshToken);

    const result = await wyze.getObjectList();

    //Save tokens to storage if they are different
    if (accessToken != result.accessToken || refreshToken != result.refreshToken){
        await saveTokens(result.accessToken, result.refreshToken);
    }
    
    if (Object.keys(result.data).length) {
        await result.data['device_list'].forEach((device) => {
            if (device['product_type'] === 'ContactSensor'){
                devices.push(device);
            }
        })
    }
    return devices;
}

async function getStatusFromApi(endpointId) {

    let retDevice = {};

    // Get tokens from DB
    let tokens = await getTokens();
    let accessToken = tokens.Item.accessToken;
    let refreshToken = tokens.Item.refreshToken;
    await wyze.setTokens(accessToken, refreshToken);

    const result = await wyze.getObjectList();

    //Save tokens to storage if they are different
    if (accessToken != result.accessToken || refreshToken != result.refreshToken){
        await saveTokens(result.accessToken, result.refreshToken);
    }
    
    if (Object.keys(result.data).length) {
        await result.data['device_list'].forEach((device) => {
            if (device.nickname.replace(' ', '').toLowerCase() === endpointId.replace('-01', '')){
                retDevice = device
            }
        })
    }
    return retDevice;
}

async function getTokens() {
    const params = {
        TableName: 'WYZE_SETTINGS',
        Key: {
          "id": phoneId
        }
      };
      return await dynamo.getItem(params).promise();
}

async function saveTokens(accessToken, refreshToken) {
    const params = {
        TableName : 'WYZE_SETTINGS',
        Item: {
            "id": phoneId,
            "accessToken": accessToken,
            "refreshToken": refreshToken
        }
    };
    return await dynamo.putItem(params).promise();
}
