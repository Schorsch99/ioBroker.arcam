"use strict";
/*
Arcam Adapter for iobroker
LD 12-2017
0.0.3
 */

var configJSON = require('./io-package.json');
var utils = require(__dirname + '/lib/utils');
var net = require('net');
var S = require('string');
var adapter = utils.adapter('arcam');
var socketAVR = "";
var stValue;
var connecting;
var host;
var port;
var qtyTunerPresets;
var volumeStepLimit;
var smoothVolRiseTime;
var smoothVolFallTime;
var softMuteRiseTime;
var softMuteFallTime;
var stepMuteAttenuation;
var stateCache = {
	currentInput: "",
	currentInput2: "",
	currentVolume: 30, //initialize with low volume to avoid jumps on first startup before volume is read from AVR
	currentVolume2: 30, //initialize with low volume to avoid jumps on first startup before volume is read from AVR
	currentFrequency: ""
};
var statesReady = 0;
var statusRequestActive = 0;
var errorMessage = "";
var myObj_iO = configJSON.instanceObjects;
var lookup_master = { // contains default values
			stateNameX: "",
			stateValue: "",
			name: "",
			Zn: "01",
			Cc: "",
			RxCc: "",
			TxCc: "",
			Data: "",
			RxData: "",
			TxData: "",
			dataEncoding: "ASCII",
			depends: "", // e.g. CURRENT_SOURCE, NET_PLAYBACK
			condition: "",
			dataStart: 0,
			dataLength: 1,
			valuePrefix: "",
			valueSuffix: "",
			min: 0,
			max: 99,
			step: 1
		};

var stringReplacementTable = [
	['ä', 'ae', '91', 'e4'],
	['ö', 'oe', '97', 'f6'],
	['ü', 'ue', '99', 'fc'],
	['Ä', 'Ae', '??', 'c4'],
	['Ö', 'Oe', 'd7', 'd6'],
	['Ü', 'Ue', '??', 'dc'],
	['ß', 'ss', '8d', 'df']
];

adapter.on('message', function (obj) {
	adapter.log.debug("<< ADAPTER MESSAGE >>");
});

adapter.on('ready', function () {
	adapter.log.debug("<< ADAPTER READY >>");
	main();
});

adapter.on('unload', function () {
	adapter.log.debug("<< ADAPTER UNLOAD >>");
});

adapter.on('stateChange', function (id, state) { //if adapter state changes do
	if (!id || !state || state.ack) {
		return;
	}

	var deleteStr = adapter.namespace + "."; // define string to be removed
	var idStateName = S(id).strip(deleteStr).s; // remove string
	
	if (idStateName.indexOf(".Ctl") > -1) { // if stateName contains ".Ctl_" then change to Control handling
		adapter.log.debug("ControlState change: " + idStateName + " " + state.val);
		var controlReturn = control(idStateName, state.val);
	}
	Tx_Block: {
	if (controlReturn === 'exit') {
		break Tx_Block;
	}

	var commMode = "Tx";
	adapter.log.debug("State change: " + idStateName + " " + state.val);
	


var resultArrayTx = lookupTx(idStateName, state.val, commMode);


if ((resultArrayTx[0])&&(resultArrayTx[1])&&(resultArrayTx[2])){
	var Tx_Cc = resultArrayTx[0];
	var Tx_Zn = resultArrayTx[1];
	var Tx_Data_Str = resultArrayTx[2] + "";
	sendIP(Tx_Zn, Tx_Cc, Tx_Data_Str); // send Data
	}
	}
});

function lookupTx(idStateName, stateVal, commMode){		
		
		
		var resultArrayLookupTx = [];
		//var myObj_iO = configJSON.instanceObjects;
		var matchTxData = 0;
		
		for (var element_iO in myObj_iO){
			if (matchTxData === 1){
				break;
			}
			
			var myObj_common = myObj_iO[element_iO]["common"];		
			if ((getTxRxValue(myObj_iO[element_iO], "_id", commMode) != idStateName) || (getTxRxValue(myObj_common, "Cc", commMode) === "error") ){
				continue; // continue with next iteration if Zn or RxCc do not match or if "_id" does not exist
			} else {
				var lookup_iO = Object.assign({},lookup_master);				
				//lookup_iO.stateNameX = myObj_iO[element_iO]["_id"]; // assign stateName
				lookup_iO = getExistingObjectValues(lookup_iO, myObj_iO[element_iO]);

				//next level:
				var lookup_common = Object.assign({},lookup_iO); // copy parent level lookup
				lookup_common = getExistingObjectValues(lookup_common, myObj_common); //replace data in lookup_common with data from JSON common if they exist
				//next level: dataSegments
				for (var element_dS in myObj_common["dataSegments"]){
					var myObj_dS = myObj_common.dataSegments[element_dS];
					var lookup_dS = Object.assign({},lookup_common);
					lookup_dS = getExistingObjectValues(lookup_dS, myObj_dS); //replace data in lookup_dS with data from JSON common if they exist
													
					//next level: values
					for (var element_val in myObj_dS["values"]){
						var myObj_val = myObj_dS["values"][element_val];
						var lookup_val = Object.assign({},lookup_dS);
						lookup_val = getExistingObjectValues(lookup_val, myObj_val); //replace data in lookup_val with data from JSON common if they exist
						if ((lookup_val.TxData == "") && (lookup_val.Data != "")) {
							lookup_val.TxData = lookup_val.Data;
							}
						if ((lookup_val.TxCc == "") && (lookup_val.Cc != "")) {
							lookup_val.TxCc = lookup_val.Cc;
							}
						if (stateVal === "REQ") {
							if (lookup_val.RxCc != ""){							
								lookup_val.TxCc = lookup_val.RxCc;
							} else {
								lookup_val.TxCc = lookup_val.Cc;
							}
						}							
						var {name, dataStart, dataLength, min, max, step, dataEncoding, stateValue, stateNameX, depends, condition, TxData, Zn} = lookup_val;
						
						var dependsCheck; // check for dependencies of information or states
						if (depends == ""){
							dependsCheck = true;
						} else
						{
						if ((condition === stateCache[depends]) || (condition === "DEFAULT")){
							dependsCheck = true;
						} else
						{
								dependsCheck = false;
						}}
						
						//var TxDataSnip = dataSplit(stateVal, dataStart, dataLength); // 
						if (stateVal !== "REQ"){
							if (((lookup_val.stateValue == stateVal) || (lookup_val.stateValue === "VALUE")) && (dependsCheck === true)){
								var ConvData = dataConversion(stateVal, stateValue, dataEncoding, min, max, step, commMode, TxData, Zn);
								if (ConvData != "error"){
									//var dataIndex = myObj_dS["name"].slice(-1);
									//dataIndex = parseInt(dataIndex, 10)-1;
									lookup_val.TxData = ConvData;
									resultArrayLookupTx[0] = lookup_val.TxCc;
									resultArrayLookupTx[1] = lookup_val.Zn;
									resultArrayLookupTx[2] = lookup_val.TxData;
									matchTxData = 1;
									break;
								}
							}
						} else {
							if ((lookup_val.stateValue == stateVal)  && (dependsCheck === true)){
									resultArrayLookupTx[0] = lookup_val.TxCc;
									resultArrayLookupTx[1] = lookup_val.Zn;
									resultArrayLookupTx[2] = lookup_val.TxData;
									matchTxData = 1;
									break;
							}
						}
					}
				}	
			}					
		}		
/*			var resultStateValue = "";
			for (var m = 0; m < resultStateValueArray.length; m++){
				resultStateValue += resultStateValueArray[m];
			}
			adapter.log.debug("Neue Auswertung ergibt: stateNameX= " + resultStateName + " stateValueX: " + resultStateValue);
	
			if (errorMessage != ""){
				//adapter.log.debug("NEWERROR " + errorMessage);
				errorMessage = ""; // Reset errorMessage
			}
			//	adapter.log.debug("NEW " + "stateNameX: " + resultStateName + " / " + "stateValueX: " + resultStateValue);
*/
resultArrayLookupTx[3] = errorMessage;
return(resultArrayLookupTx);
}

function control(idstateName, stateVal) {
	if (stateVal == 'ff'){
		return 'exit';
	}
	switch (idstateName) {
	case "arcamTuner.FM.Tune.Ctl_DirectTune":
		adapter.log.debug("direct tune called");
		FMdirectTune(stateVal);
		return 'exit';
		break;
	case "arcamTest.Test1.Ctl_Test1": // temporary, for different test purposes only
		requestStatus("wasserbaum");
		return 'exit';
		break;
	default:
		break;
	}
}

function sendIP(Tx_Zn, Tx_Cc, Tx_Data_Str) { //send IP based on arguments
	const Tx_St = 0x21; // Arcam standard message Start-ID
	const Tx_Et = 0x0D; // Arcam standard message End-ID
	var Tx_Dl = dataLengthMod2(Tx_Data_Str); // determine Data length
	var bufferSize = 4 + Tx_Dl + 1; // compute the required buffer length
	var buffer = new Buffer(bufferSize); //initialize Buffer
	buffer.writeUInt8(Tx_St, 0);
	buffer.writeUInt8(Tx_Zn, 1);
	Tx_Cc = parseInt(Tx_Cc, 16);
	buffer.writeUInt8(Tx_Cc, 2);
	buffer.writeUInt8(Tx_Dl, 3);
	for (var z = 0; z < Tx_Dl; z++){ // fill Buffer with individual Bytes from Tx_Data_Str
		var byteStart = 2 * z;
		var strSlice = Tx_Data_Str.slice(byteStart, byteStart + 2);
		var writeData = parseInt(strSlice, 16);
		// adapter.log.debug('writeData: ' + writeData);
		buffer.writeUInt8(writeData, 4 + z);
	}
	buffer.writeUInt8(Tx_Et, 4 + Tx_Dl);
	if (connecting === false) {
		socketAVR.write(buffer); // write Buffer to IP socket
		adapter.log.debug("Gesendet wird: TxCc= " + Tx_Cc + " TxZn: " + Tx_Zn + " TxData: " + writeData);
		} else {
		return "Tx error";
	}

}

// überarbeiten
function requestStatus(requestSelect) { // valid arguments: [AMP / PRESET / ALL /specific state]
	var p = 0;
	var stateArray = [];

	for (var element_iO in myObj_iO){
		stateArray[p] = myObj_iO[element_iO]["_id"];
		p++
	}	
	
	if (stateArray.includes(requestSelect)=== true){
		var resultArrayTx= lookupTx(requestSelect, "REQ", "Tx");
				if ((resultArrayTx[0])&&(resultArrayTx[1])&&(resultArrayTx[2])){
					var Tx_Cc = resultArrayTx[0];
					var Tx_Zn = resultArrayTx[1];
					if (Tx_Cc == "1b"){
						var Tx_Data_Str = parseInt(resultArrayTx[2], 10);
						Tx_Data_Str = Tx_Data_Str.toString(16);
						Tx_Data_Str = S(Tx_Data_Str).padLeft(2, 0).s
					} else {
						var Tx_Data_Str = resultArrayTx[2];
					}
				sendIP(Tx_Zn, Tx_Cc, Tx_Data_Str); // send Data
				}
	} else {	
	var q = 0;
	adapter.log.debug(requestSelect);
	setTimeout(function requestLoopAMP() {
		//for (var q = 0; q < stateArray.length; q++)
		if (q < stateArray.length){
			var resultArrayTx= lookupTx(stateArray[q], "REQ", "Tx");
			if ((resultArrayTx[0])&&(resultArrayTx[1])&&(resultArrayTx[2])){
				var Tx_Cc = resultArrayTx[0];
				var Tx_Zn = resultArrayTx[1];
				if (Tx_Cc == "1b"){
					var Tx_Data_Str = parseInt(resultArrayTx[2], 10);
					Tx_Data_Str = Tx_Data_Str.toString(16);
					Tx_Data_Str = S(Tx_Data_Str).padLeft(2, 0).s
				} else {
					var Tx_Data_Str = resultArrayTx[2];
				}
				adapter.log.debug(stateArray[q] + " / " + Tx_Zn + " / " + Tx_Cc + " / " + Tx_Data_Str);
				sendIP(Tx_Zn, Tx_Cc, Tx_Data_Str); // send Data
			}
			q++;
			var mumpitz = setTimeout(requestLoopAMP, 200);	
		}
		else { 
			var requestComplete = 1;
			return;
		}
	})
	}	
}

function dataLengthMod2(data) { //determine Data length
	if (data.length % 2 !== 0) {
		return (data.length + 1) / 2; //if odd, then add 1 and divide by 2. odd number possible because e.g. 0x0b translates to 'b'
	} else {
		return (data.length) / 2; //if even, then divide by 2
	}
}

function connectToArcam(host) {
	socketAVR = net.connect({
			port: 50000,
			host: host
		}, function () {
			adapter.log.debug("adapter connected to ARCAM-AVR: " + host + ":" + "50000");
		});
	connecting = false;
	//adapter.log.debug(host + ":" + port);
	//autoRequest();
	
	function restartConnection() {
		adapter.log.debug("<<< Restart Connection Called >>>");
		adapter.setState("arcamSystem.Info.Connected", {
			val: 0,
			ack: true
		});
		if (socketAVR) {
			socketAVR.end();
			socketAVR = null;
		}
		if (!connecting) { // try to reconnect every 10 seconds
			adapter.log.debug("<<< Restart Connection >>>");
			connecting = setTimeout(function () {
					connectToArcam(host);
				}, 10000);
		}
	}

	//
	// probieren, ob man das nachfolgende nicht aus der function connectToArcam ausgliedern kann
	//

	socketAVR.on('connect', function() {
		
		adapter.setState("arcamSystem.Info.Connected", {
		val: 1,
		ack: true
		});
	});
	autoRequest(); // temp disable
	
	socketAVR.on('error', restartConnection);

	socketAVR.on('close', restartConnection);

	socketAVR.on('end', restartConnection);

	socketAVR.on('data', function (data) {
		var dataStr = data.toString('hex');
		var byteLength = data.byteLength;
		var response = dataStr.split("\r"); //adapter.log.info("data from " + adapter.config.host + ": *" + dataStr + "*");
		//
		// Response-Auswertung in eigene Funktion verschieben
		//

		for (var i = 0; i < response.length; i++) {
			var Rx_St = response[i].substr(0, 2); //Start-Byte
			var Rx_Zn = response[i].substr(2, 2); //Zone
			var Rx_Cc = response[i].substr(4, 2); //CommandCode
			var Rx_Ac = response[i].substr(6, 2); //AnswerCode
			var Rx_Dl_Hex = response[i].substr(8, 2); //DataLength Hex: Anzahl der Bytes
			//var Rx_Dl_Chr = parseInt(Rx_Dl_Hex, 16); //DataLength Chr: Anzahl der Zeichen
			var Rx_Data = response[i].slice(10, -2); //Data
			var Rx_Et = response[i].slice(-2); //End Transmission


			adapter.log.debug("debug: *" + "Rx_St: " + Rx_St + " Rx_Zn: " + Rx_Zn + " Cc: " + Rx_Cc + " Rx_Ac: " + Rx_Ac + " Rx_Dl: " + Rx_Dl_Hex + " Rx_Data: " + Rx_Data + " Rx_Et:" + Rx_Et + "* ");

			if (Rx_St == "21" && Rx_Et == "0d") // Check Start- and EndByte
			{

	var commMode = "Rx";
	var RxCc = Rx_Cc; //temporäre Zuweisung)
	var RxZn = Rx_Zn; //temporäre Zuweisung)
	var RxData = Rx_Data; //temporäre Zuweisung)
	var resultStateValueArray = [];			
	
	var resultArrayRx = lookupRx(Rx_Cc, Rx_Zn, Rx_Data, commMode);


			var stateVal = "";
			for (var m = 1; m < resultArrayRx.length; m++){
				stateVal += resultArrayRx[m];
			}
			/*if (errorMessage != ""){
				adapter.log.debug("NEWERROR " + errorMessage);
				errorMessage = ""; // Reset errorMessage
			}*/
	
			var zoneName;
			var stateName = resultArrayRx[0]
			var stateName2;
			var stateVal2;
			var stateCount = 1;
			switch (Rx_Ac) {
				case "82":
					adapter.log.debug("Zone " + Rx_Zn + " invalid");
					break;
				case "83":
					adapter.log.debug("Command not recognized");
					break;
				case "84":
					adapter.log.debug("Parameter " + Rx_Data + " not recognized");
					break;
				case "85":
					adapter.log.debug("Command " + Rx_Cc + " " + Rx_Data + " invalid at this time");
					break;
				case "86":
					adapter.log.debug("Invalid data length");
					break;
				case "00":
					switch (stateName)
					{
						case "arcamAudio.Volume.Volume":
							stateCache.currentVolume = parseInt(stateVal, 10);
							break;
						case "arcamAudio.Volume.Volume2":
							stateCache.currentVolume2 = parseInt(stateVal, 10);
							break;
						case "arcamInput.Input":
							stateCache.currentInput = stateVal;
							break;
						case "arcamInput.Input2":
							stateCache.currentInput2 = stateVal;
							break;
						case "arcamTuner.FM.Tune.Frequency":
							stateCache.currentFrequency = stateVal;
							break;
						case "arcamTuner.Preset":
							var stateCount = 2;
							stateName = resultArrayRx[0] + resultArrayRx[1] + "Band";
							stateVal = resultArrayRx[2];
							stateName2 = resultArrayRx[0] + resultArrayRx[1] + "StationName";
							stateVal2 = resultArrayRx[3];
							break;
						default:
							break;
					}					
					adapter.setState(stateName, {
					val: stateVal,
					ack: true
					});
					adapter.log.debug("State *** " + stateName + " *** set with value *** " + stateVal + " ***");
					if (stateCount === 2) {
						adapter.setState(stateName2, {
							val: stateVal2,
							ack: true
					});
					adapter.log.debug("State2 *** " + stateName2 + " *** set with value *** " + stateVal2 + " ***");
					break;
					}
								
				default:
					break;
				}
			} 
		
	}
	})
	
}

function lookupRx(RxCc, RxZn, RxData, commMode){

//	foo2:{		
		var resultArrayLookupRx = [];
		var matchStateValue = 0;
		
			for (var element_iO in myObj_iO){
				if (matchStateValue === 1){
					break;
				}
				var myObj_common = myObj_iO[element_iO]["common"];		
				if ((getTxRxValue(myObj_common, "Cc", commMode) != RxCc) || (getTxRxValue(myObj_common, "Zn", commMode) != RxZn) || getTxRxValue(myObj_iO[element_iO], "_id", commMode) === "error"){
					continue; // continue with next iteration if Zn or RxCc do not match or if "_id" does not exist
				} else {
				var lookup_iO = Object.assign({},lookup_master);				
				lookup_iO.stateNameX = myObj_iO[element_iO]["_id"]; // assign stateName
				lookup_iO = getExistingObjectValues(lookup_iO, myObj_iO[element_iO]);

					//next level:
					var lookup_common = Object.assign({},lookup_iO); // copy parent level lookup
					lookup_common = getExistingObjectValues(lookup_common, myObj_common); //replace data in lookup_common with data from JSON common if they exist
							
					//next level: dataSegments
					for (var element_dS in myObj_common["dataSegments"]){
							var myObj_dS = myObj_common.dataSegments[element_dS];
							var lookup_dS = Object.assign({},lookup_common);
							lookup_dS = getExistingObjectValues(lookup_dS, myObj_dS); //replace data in lookup_common with data from JSON common if they exist
														
						//next level: values
						for (var element_val in myObj_dS["values"]){
							var myObj_val = myObj_dS["values"][element_val];
							var lookup_val = Object.assign({},lookup_dS);
							lookup_val = getExistingObjectValues(lookup_val, myObj_val); //replace data in lookup_common with data from JSON common if they exist
							if (lookup_val.RxData == ""){
								lookup_val.RxData = lookup_val.Data;
								}
							var {name, dataStart, dataLength, min, max, step, dataEncoding, stateValue, stateNameX, depends, condition, Zn} = lookup_val;
							
							var dependsCheck; // check for dependencies of information or states
							if (depends == ""){
								dependsCheck = true;
							} else
							{
							if ((condition === stateCache[depends]) || (condition === "DEFAULT")){
								dependsCheck = true;
							} else
							{
									dependsCheck = false;
							}}
							
							var RxDataSnip = dataSplit(RxData, dataStart, dataLength); // 
							if (((lookup_val.RxData == RxDataSnip) || (lookup_val.RxData === "VALUE")) && (dependsCheck === true)){
								var ConvData = dataConversion(RxDataSnip, stateValue, dataEncoding, min, max, step, commMode, "null", Zn);
								if (ConvData != "error"){
									var dataIndex = myObj_dS["name"].slice(-1);
									dataIndex = parseInt(dataIndex, 10);
									lookup_val.stateValueX = ConvData;
									resultArrayLookupRx[0] = lookup_val.stateNameX;
									resultArrayLookupRx[dataIndex] = lookup_val.valuePrefix + lookup_val.stateValueX + lookup_val.valueSuffix;matchStateValue = 1;
									break;
								}
							}
						}
					}	
				}					
			}		
	return resultArrayLookupRx;	
	}






function getExistingObjectValues(masterObj, fetchObj){
	for (var key in masterObj){
		if (typeof fetchObj[key] != "undefined"){
			masterObj[key] = fetchObj[key];
		}
	}
	return masterObj;
}

function dataConversion(input, lookupStateValue, encoding, min, max, step, direction, TxData, Zone){
	var output;
	switch (encoding)
	{
		case "ASCII":
			switch (direction)
			{
				case "Rx":
					output = hex2ascii(input);
					output = output.trim();
				break;
				case "Tx":
					output = ascii2hex(input);
				break;
			}
			break;
		
		case "DISCRETE":
			switch (direction)
			{
				case "Rx":
					output = lookupStateValue;
				break;			
				case "Tx":
					output = TxData;
				break;
			}
			break;		
		
		case "VOLUME":
			switch (direction)
			{
				case "Rx":
					output = parseInt(input, 16);
					if ((output < min) || (output > max)){
						output = "error";
					}
				break;			
				case "Tx":
					if ((input < min) || (input > max)){
					output = "error";
				} else {
					switch (Zone)
					{
						case "01":
							output = limitVolumeStep(input, stateCache.currentVolume);
						break;
						case "02":
							output = limitVolumeStep(input, stateCache.currentVolume2);
						break;
					}
					output = output.toString(16);
					if (output.length % 2 != 0){
						output = S(output).padLeft(output.length + 1, 0).s
					}
				}
				break;
			}
			break;
		
		case "INTEGER":
			switch (direction)
			{
				case "Rx":
					output = parseInt(input, 16);
					/*if ((output < min) || (output > max)){
						output = "error";
					}*/
				break;			
				case "Tx":
					if ((input < min) || (input > max)){
					output = "error";
				} else {
					output = input.toString(16);
					if (output.length % 2 != 0){
					output = S(output).padLeft(output.length + 1, 0).s
					}
				}
				break;
			}
			break;
		
		case "FREQUENCY":
			output = parseInt(input, 16);
			if ((output < min) || (output > max)){
				output = "error";
			}
			break;
		
		case "TONE":
			switch (direction)
			{
				case "Rx":
					var toneVal = parseInt(input, 16);
					if (0 <= toneVal && toneVal <= (0 + max)) {
						output = toneVal * step;
						break;
					} 
					if (129 <= toneVal && toneVal <= (129 - min)) {
						output = (-1) * (toneVal - 128) * step;
						break;
					}
					break;
				
				case "Tx":
					if (0 <= input && input <= (0 + max)) {
						output = input / step;
					} else {
					if (0 > input && input >= (0 + min)) {
						output = (((-1) * input) / step) + 128;
					}}
					output = output.toString(16);
					if (output.length % 2 != 0){
					output = S(output).padLeft(output.length + 1, 0).s
					}
					break;
			}
	}
			return output;
}



function dataSplit(dataToBeSplit, dataStart, dataLength){
	var sliceStart = 2 * dataStart; // conversion bytes in String characters
	switch(true)
	{
		case(dataLength != "n"):
			var sliceLength = 2 * dataLength;
			var sliceEnd = sliceStart + sliceLength;
			var dataSnip = dataToBeSplit.slice(sliceStart, sliceEnd);
			break;
		case(dataLength == "n"):
			var dataSnip = dataToBeSplit.slice(sliceStart);
			break;
	}
	return dataSnip;
}

function getTxRxValue(where, what, direction){ // return "what" if it exists in "where". if not, same for "direction" + "what", else return "error"
var TxRxData = getValue(where, what,  "error");
if (TxRxData !== "error"){
	return TxRxData;
} else {
var TxRxData = getValue(where, direction + what, "error");
if (TxRxData !== "error"){
	return TxRxData;
} else {
	return "error"
}
}
}

function getValue(path, key, errorReturn){ // return value from path[key] 
	if (path[key] !== undefined){
		var myValue = path[key];
		return myValue;
	} else {
		var path = path.toString() + ""; 
		errorMessage = "key " + path + " " + key + " not found";
	return errorReturn;
	}
}

function autoRequest(){
setTimeout(function autoReq() {
		if (statesReady == 1){
		adapter.log.debug("verification of states completed - starting autoRequest");
		requestStatus('ALL'); // noch ändern in ALL, wenn funktioniert
		} else {
		setTimeout(autoReq(), 500);
		}
	}, 2000);
}


function hex2ascii(str1) { // convert HEX to ASCII
	var hex = str1.toString();
	// include dependency on setup or iobroker language/country setting
	// if (country == de || at || ch){
	hex = fixSpecialCharacters(hex);
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}


function ascii2hex(str1){ // convert ASCII to HEX
	var arr1 = [];
	for (var n = 0, l = str1.length; n < l; n ++) 
     {
		var hex = Number(str1.charCodeAt(n)).toString(16);
		arr1.push(hex);
	 }
	return arr1.join('');
   }

function fixSpecialCharacters(text) { // correction for Umlaute
// Arcam sends wrong german special characters (ÄÖÜäöüß). This is a workaround and can be deleted if Arcam fixes the text output
// also other special characters are wrong (e.g. french), so additions to replacement table (see above) are welcome
	var snip;
	var text2 = text + "";
	var newText = "";
	for (var i = 0; i < text2.length; i = i + 2) {
		snip = text2.substring(i, i + 2);
		for (var j = 0; j < stringReplacementTable.length; j++) {
			var searchStr = stringReplacementTable[j][2];
			var replaceStr = stringReplacementTable[j][3];
			snip = snip.replace(searchStr, replaceStr);
		}
		newText = newText + snip;
	}
	return newText;
}

function createStatesIfNotExist() { // create states if they do not exist yet
	
	for (let element_iO in myObj_iO){
		let id_iO = adapter.namespace + "." + getValue(myObj_iO[element_iO], "_id", "");
		let type_iO = getValue(myObj_iO, "type", "");
		let myObj_common = myObj_iO[element_iO]["common"];
		let name_common = getValue(myObj_common, "name", "");
		let type_common = getValue(myObj_common, "type", "");
		let role_common = getValue(myObj_common, "role", "");
		let read_common = getValue(myObj_common, "read", "");
		let write_common = getValue(myObj_common, "write", "");
		let desc_common = getValue(myObj_common, "desc", "");
		adapter.log.debug(id_iO);
		adapter.setObjectNotExists(id_iO, {
			type: type_iO,
				common: {
					name: name_common,
					type: type_common,
					role: role_common,
					read: read_common,
					write: write_common,
					desc: desc_common
				},
				native: {}
		});
	}
}

// Additional Functions


function FMdirectTune(directTuneFrequencyRaw) {
	// FMdirectTune: calculates shortest delta between current and directTuneFrequency, determines direction and number of steps (0.05MHz per step) and sends IP accodingly.
	//250ms pause between IPdata is required for reliable operation.
	//input can be: 97,3 97,30 97.3 97.30 9730 973 97:3 97:30

	requestStatus('arcamTuner.FM.Tune.Frequency'); // überflüssig?
	var directTuneFrequency = S(directTuneFrequencyRaw).strip(' ', '_', ',', '.', ':').s; // strip delimiters
	var directTuneFrequencyChr1 = S(directTuneFrequency).left(1).s; // get first digit
	switch (directTuneFrequencyChr1) { // define length based on 1st character
		case '8':
		case '9':
			var freqLength = 4;
			break;
		case '1':
		default:	
			var freqLength = 5;
			break;
	}
	directTuneFrequency = S(directTuneFrequency).padRight(freqLength, 0).s;
	directTuneFrequency = parseInt(directTuneFrequency, 10); // convert to Integer
	
	var currentFrequency = S(stateCache.currentFrequency).strip(' ', '_', ',', '.', ':', 'MHz').s; // strip delimiters
	currentFrequency = parseInt(currentFrequency, 10);  // convert to Integer

	if ((directTuneFrequency < 8750) || (directTuneFrequency > 10800)) { // check if in allowed range
		adapter.log.debug("Invalid Tuning Frequency");
		return;
	}
	if (directTuneFrequency == currentFrequency) { // check if no change
		adapter.log.debug("No Frequency Change");
		return;
	}

	var deltaFrequency, deltaFrequency1, deltaFrequency2, tuningDirection, tuningSteps, FMzone;
	
	deltaFrequency1 = Math.abs(directTuneFrequency - currentFrequency);
	deltaFrequency2 = (10800 - Math.max(directTuneFrequency, currentFrequency)) + (Math.min(directTuneFrequency, currentFrequency) - 8745);
	if (deltaFrequency1 <= deltaFrequency2) {
		deltaFrequency = deltaFrequency1;
		if (directTuneFrequency < currentFrequency) {
			tuningDirection = "down";
		} else {
			tuningDirection = "up";
		}
	} else {
		deltaFrequency = deltaFrequency2;
		if (directTuneFrequency < currentFrequency) {
			tuningDirection = "up";
		} else {
			tuningDirection = "down";
		}
	}
	tuningSteps = Math.abs(deltaFrequency / 5);
	FMzone = 0x01;
	tuneFM(FMzone, tuningSteps, tuningDirection);
}

function tuneFM(FMzone, tuningSteps, tuningDirection) {
	var tuningDirectionData;
	
	adapter.log.debug("tuning " + tuningDirection + " by " + tuningSteps + " steps");
	if (tuningDirection === "down") {
		tuningDirectionData = '00';
	}
	if (tuningDirection === "up") {
		tuningDirectionData = '01';
	}
	let i = 0;
	var FMzone = FMzone;
	setTimeout(function sendTuneCommand() {
		if (i >= tuningSteps) {
			return;
		} else {
			sendIP(FMzone, '16', tuningDirectionData);
			i++;
		}
		setTimeout(sendTuneCommand, 250);
	}, 250);
}

function limitVolumeStep(targetVol, currentVol){
// limits the maximum (positive) volume step to xdB, defined by volumeStepLimit. Avoids accidental increases and potential damage to speakers
// var volumeStepLimit = 10; //e.g. 10dB max step
if ((targetVol - currentVol) > volumeStepLimit){
	var filteredVolume = currentVol + volumeStepLimit;
	} else {
	var filteredVolume = targetVol;
}
return filteredVolume;
}

function main() {
	
	adapter.log.debug("<< ADAPTER MAIN BLOCK >>");
	/*var ip_port = adapter.config.host;
	var ip_port_array = ip_port.split(":");
	var host = ip_port_array[0];
	if (ip_port_array[1]){
		var port = ip_port_array[1];
	} else {
		var port = 50000;
	}*/
	host = adapter.config.host;
	port = adapter.config.port;
	qtyTunerPresets = parseInt(adapter.config.qtyTunerPresets, 10);
	volumeStepLimit = parseInt(adapter.config.volumeStepLimit, 10);
	smoothVolRiseTime = parseInt(adapter.config.smoothVolRiseTime, 10);
	smoothVolFallTime = parseInt(adapter.config.smoothVolFallTime, 10);
	softMuteRiseTime = parseInt(adapter.config.softMuteRiseTime, 10);
	softMuteFallTime = parseInt(adapter.config.softMuteFallTime, 10);
	stepMuteAttenuation = parseInt(adapter.config.stepMuteAttenuation, 10);
	createStatesIfNotExist();
	adapter.subscribeStates('*'); // subscribe to all states inside the adapter's namespace
	statesReady = 1;
	connectToArcam(host);
}

/*
Gerüst autodetect
function autodetect(){
hol basis IP von iobroker-gerät
ping alles von *.001 beginnend
wenn ping, dann sende “AMX\r” (wie auch immer...)
bis response:  “AMXB<Device-SDKClass=Receiver><Device-Make=ARCAM><Device-Model=AV860><Device-Revision=x.y.z>\r”
merke IP und stelle diese eindeutig
auswerten response um Gerätetyp anzeigen zu können (nice to have)
}
*/

/*
Gerüst DLD_PDT- sowie RDS-History
globale Variablen anlegen:
- radioText + State anlegen
- radioText_latest
- radioText_history_1
- radioText_history_2
- radioText_history_3

DLS_PDT und RDS unter "Special" aufnehmen

wenn Message reinkommt:
radioText_history_3 = radioText_history_2
radioText_history_2 = radioText_history_1
radioText_history_1 = radioText_latest
radioText_latest = neue Message
radioText = radioText_latest + Zeilenumbruch + radioText_history_1 + Zeilenumbruch + radioText_history_2  + Zeilenumbruch + radioText_history_3
setState radioText

Bei Senderwechsel oder wegschalten von radio:
radioText_history_3 = "* " + radioText_history_3
radioText_history_2 = "* " + radioText_history_2
radioText_history_1 = "* " + radioText_history_1
radioText_latest = "* " + radioText_latest
radioText = radioText_latest + Zeilenumbruch + radioText_history_1 + Zeilenumbruch + radioText_history_2  + Zeilenumbruch + radioText_history_3
setState radioText

*/

/*
Gerüst SoftVolume (alles auch für die 2. Zone auslegen, mit Ausnahme der Relaisaktivierung bei Mute in Zone2)
Einführen globale Variable stateCache.currentVolume und stateCache.currentVolume2, wird bei Volumeänderung laufend aktualisiert
Einführen globale Variable volumeMemory und volumeMemory2, wird nur zu Beginn eines Ramp-Vorgangs beschrieben

Konfiguration: softVolumeRampTime // '0' = OFF
Konfiguration: softMuteRampTime // '0' = OFF
Konfiguration: fixedMuteLevel // e.g. 20dB
(Konfiguration: bei fixedMuteLevel Display blinken yes/no)

SoftVolume: hole stateCache.currentVolume & targetVolume
(bei SoftMute: targetVolume = '0')
(bei muteFixedLevel: targetVolume = stateCache.currentvolume - fixedMuteLevel)

volumeMemory = stateCache.currentVolume // define startlevel // to memorize last "normal" volume for later resume
numberOfSteps = Runden (rampTime / requiredMessageDelay); // determine no of Steps based on desired ramp time and required message delay time
an dieser Stelle rampTime je nach aktivierter Funktion wählen (softMute oder softVolume)

softVolumeStep = Runden((targetVolume - stateCache.currentVolume) / numberOfSteps) // aktuelle Lautstärke und runde auf Ganzahl(5 Schritte als Beispiel, ausprobieren was gut geht)

softVolumeLevel = stateCache.currentVolume // define startlevel
von 1 bis (numberOfSteps - 1 ) sende softVolumeVolume = (softVolumeLevel + softVolumeStep) // wenn softVolumeStep negativ: reduzierung, sonst erhöhung
bei erreichen numberOfSteps sende targetVolume // to compensate for rounding errors
nur bei Mute und nur für Zone1 Lautsprecherrelais aktivieren
Gimmick nur bei muteFixedLevel: Display blinken lassen

bei MuteOff das ganze rückwärts


Mögliche Fallstricke: evtl. müssen während Ramp die emfangenen Volume messages ignoriert werden

*/

