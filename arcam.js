"use strict";
/*
Arcam Adapter for iobroker
LD 11-2017
 */

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
var currentFrequencyStr; // global variable, used for directTune feature
var currentVolume = 30; //initialize with low volume to avoid jumps on first startup before volume is read from AVR
var currentVolume2 = 30; //initialize with low volume to avoid jumps on first startup before volume is read from AVR
var currentInput;
var currentInput2;
var statesReady = 0;
var statusRequestActive = 0;

var lookupTable = [
	//	stateName						stateVal			Mode	Cc		Data_Z1		Data_Z2		DataType	Zones	createState(w/r)
	['arcamAudio.Volume.Volume', 'VALUE', 'TxRx', '0d', 'VALUE', 'VALUE', 'Volume', 2, '0'],
	['arcamAudio.Volume.Volume', 'Req', 'Req', '0d', 'f0', 'f0', 'Discrete', 2, 'wr'],
	
	//arcamInput.Input Tx (via RC5)
	['arcamInput.Input', 'Follow Zone 1', 'Tx', '08', '1014', '1700', 'Discrete', 2, '0'],
	['arcamInput.Input', 'CD', 'Tx', '08', '1076', '1706', 'Discrete', 2, '0'],
	['arcamInput.Input', 'BD', 'Tx', '08', '1062', '1707', 'Discrete', 2, '0'],
	['arcamInput.Input', 'AV', 'Tx', '08', '105e', '1709', 'Discrete', 2, '0'],
	['arcamInput.Input', 'SAT', 'Tx', '08', '101b', '1714', 'Discrete', 2, '0'],
	['arcamInput.Input', 'PVR', 'Tx', '08', '1060', '170f', 'Discrete', 2, '0'],
	['arcamInput.Input', 'VCR', 'Tx', '08', '1077', '1715', 'Discrete', 2, '0'],
	['arcamInput.Input', 'AUX', 'Tx', '08', '1063', '170d', 'Discrete', 2, '0'],
	['arcamInput.Input', 'DISPLAY', 'Tx', '08', '1063', '170d', 'Discrete', 2, '0'],
	['arcamInput.Input', 'FM', 'Tx', '08', '101c', '170e', 'Discrete', 2, '0'],
	['arcamInput.Input', 'DAB', 'Tx', '08', '1048', '1710', 'Discrete', 2, '0'],
	['arcamInput.Input', 'NET', 'Tx', '08', '105c', '1713', 'Discrete', 2, '0'],
	['arcamInput.Input', 'USB', 'Tx', '08', '105d', '1712', 'Discrete', 2, '0'],
	['arcamInput.Input', 'STB', 'Tx', '08', '1064', '1708', 'Discrete', 2, '0'],
	['arcamInput.Input', 'GAME', 'Tx', '08', '1061', '170b', 'Discrete', 2, '0'],
	
	//arcamInput.Input Rx (native command)
	['arcamInput.Input', 'Follow Zone 1', 'Rx', '1d', '00', '00', 'Discrete', 2, '0'],
	['arcamInput.Input', 'CD', 'Rx', '1d', '01', '01', 'Discrete', 2, '0'],
	['arcamInput.Input', 'BD', 'Rx', '1d', '02', '02', 'Discrete', 2, '0'],
	['arcamInput.Input', 'AV', 'Rx', '1d', '03', '03', 'Discrete', 2, '0'],
	['arcamInput.Input', 'SAT', 'Rx', '1d', '04', '04', 'Discrete', 2, '0'],
	['arcamInput.Input', 'PVR', 'Rx', '1d', '05', '05', 'Discrete', 2, '0'],
	['arcamInput.Input', 'VCR', 'Rx', '1d', '06', '06', 'Discrete', 2, '0'],
	['arcamInput.Input', 'AUX', 'Rx', '1d', '08', '08', 'Discrete', 2, '0'],
	['arcamInput.Input', 'DISPLAY', 'Rx', '1d', '09', '09', 'Discrete', 2, '0'],
	['arcamInput.Input', 'FM', 'Rx', '1d', '0b', '0b', 'Discrete', 2, '0'],
	['arcamInput.Input', 'DAB', 'Rx', '1d', '0c', '0c', 'Discrete', 2, '0'],
	['arcamInput.Input', 'NET', 'Rx', '1d', '0e', '0e', 'Discrete', 2, '0'],
	['arcamInput.Input', 'USB', 'Rx', '1d', '0f', '0f', 'Discrete', 2, '0'],
	['arcamInput.Input', 'STB', 'Rx', '1d', '10', '10', 'Discrete', 2, '0'],
	['arcamInput.Input', 'GAME', 'Rx', '1d', '11', '11', 'Discrete', 2, '0'],
	['arcamInput.Input', 'Req', 'Req', '1d', 'f0', 'f0', 'Discrete', 2, 'wr'],
	
	//arcamSystem.Power Tx (via RC5)
	['arcamSystem.Power', 						0, 					'Tx', 	'08', 	'107c', 	'177c', 	'Discrete', 2, 		'0'],
	['arcamSystem.Power',						1,					'Tx',	'08',	'107b',		'177b',		'Discrete', 2,		'0'],
	
	//arcamSystem.Power Rx (native command)
	['arcamSystem.Power',						0,					'Rx',	'00',	'00',		'00',		'Discrete', 2,		'0'],
	['arcamSystem.Power',						1,					'Rx',	'00',	'01',		'01',		'Discrete', 2,		'0'],
	['arcamSystem.Power',						'Req',				'Req',	'00',	'f0',		'f0',		'Discrete', 2,		'wr'],

	//arcamAudio.Mute Tx (via RC5)
	['arcamAudio.Volume.Mute',					0,					'Tx',	'08',	'1078',		'1705',		'Discrete', 2,		'0'],
	['arcamAudio.Volume.Mute',					1,					'Tx',	'08',	'101a',		'1704',		'Discrete', 2,		'0'],
	
	//arcamAudio.Mute Rx (native command)
	['arcamAudio.Volume.Mute',					0,					'Rx',	'0e',	'01',		'01',		'Discrete', 2,		'0'],
	['arcamAudio.Volume.Mute', 1, 'Rx', '0e', '00', '00', 'Discrete', 2, '0'],
	['arcamAudio.Volume.Mute', 'Req', 'Req', '0e', 'f0', 'f0', 'Discrete', 2, 'wr'],

	['arcamAudio.Mode.RoomEq', 0, 'Tx', '37', 'f2', 'f2', 'Discrete', 1, '0'],
	['arcamAudio.Mode.RoomEq', 1, 'Tx', '37', 'f1', 'f1', 'Discrete', 1, '0'],
	['arcamAudio.Mode.RoomEq', 0, 'Rx', '37', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Mode.RoomEq', 1, 'Rx', '37', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.RoomEq', 'Req', 'Req', '37', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.DolbyVolume.Status', 'VALUE', 'TxRx', '38', 'VALUE', 'VALUE', 'Numeric', 1, '0'],
	['arcamAudio.DolbyVolume.Status', 'Req', 'Req', '38', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.DolbyVolume.CalOffset.Level', 'VALUE', 'TxRx', '3a', 'VALUE', 'VALUE', 'Tone', 1, '0'],
	['arcamAudio.DolbyVolume.CalOffset.Level', 'Req', 'Req', '3a', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.DolbyVolume.CalOffset.Ctl_Up', 1, 'TxCtl', '3a', 'f1', 'f1', 'Control', 1, 'wr'],
	['arcamAudio.DolbyVolume.CalOffset.Ctl_Down', 1, 'TxCtl', '3a', 'f2', 'f2', 'Control', 1, 'wr'],
	
	['arcamAudio.DolbyLeveller.Off', 1, 'TxRx', '39', 'ff', 'ff', 'Numeric', 1, 'wr'],
	['arcamAudio.DolbyLeveller.Level', 'VALUE', 'TxRx', '39', 'VALUE', 'VALUE', 'Numeric', 1, '0'],
	['arcamAudio.DolbyLeveller.Level', 'Req', 'Req', '39', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.DolbyLeveller.Ctl_Up', 1, 'TxCtl', '39', 'f1', 'f1', 'Discrete', 1, 'wr'],
	['arcamAudio.DolbyLeveller.Ctl_Down', 1, 'TxCtl', '39', 'f2', 'f2', 'Discrete', 1, 'wr'],
	
	['arcamDisplay.FrontPanel.Brightness', 'Display Off', 'Rx', '01', '00', '00', 'Discrete', 1, '0'],
	['arcamDisplay.FrontDisplay.Brightness', 'Display L1', 'Rx', '01', '01', '01', 'Discrete', 1, '0'],
	['arcamDisplay.FrontDisplay.Brightness', 'Display L2', 'Rx', '01', '02', '02', 'Discrete', 1, '0'],
	['arcamDisplay.FrontDisplay.Brightness', 'Req', 'Req', '01', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamDisplay.FrontDisplay.Brightness', 'Display Off',	'Tx', 	'08', 	'101f', 	'101f', 	'Discrete', 1, 		'0'],
	['arcamDisplay.FrontDisplay.Brightness',	'Display L1',	'Tx',	'08',	'1022',		'1022',		'Discrete', 1,		'0'],
	['arcamDisplay.FrontDisplay.Brightness', 'Display L2',	'Tx', 	'08', 	'1023', 	'1023', 	'Discrete', 1, 		'0'],

	
	['arcamTuner.DAB.Info.DLS_PDT_Info', 'VALUE', 'Rx', '1a', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamTuner.DAB.Info.DLS_PDT_Info', 'Req', 'Req', '1a', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.FM.Info.Genre', 'VALUE', 'Rx', '03', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamTuner.FM.Info.Genre', 'Req', 'Req', '03', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.FM.Info.RDS', 'VALUE', 'Rx', '12', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamTuner.FM.Info.RDS', 'Req', 'Req', '12', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.DAB.Info.CurrentStation', 'VALUE', 'Rx', '18', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamTuner.DAB.Info.CurrentStation', 'Req', 'Req', '18', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.DAB.Info.ProgType', 'VALUE', 'Rx', '19', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamTuner.DAB.Info.ProgType', 'Req', 'Req', '19', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamSystem.Info.SoftwareVersion', 'VALUE', 'Rx', '04', 'VALUE', 'VALUE', 'ASCII', 1, '0'],
	['arcamSystem.Info.SoftwareVersion', 'Req', 'Req', '04', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Headphones.SpeakerMuteWhenPresent', 1, 'TxRx', '1f', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Headphones.SpeakerMuteWhenPresent', 0, 'TxRx', '1f', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Headphones.SpeakerMuteWhenPresent', 'Req', 'Req', '01', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamInput.Video', 'BD', 'TxRx', '0a', '00', '00', 'Discrete', 2, '0'],
	['arcamInput.Video', 'SAT', 'TxRx', '0a', '01', '01', 'Discrete', 2, '0'],
	['arcamInput.Video', 'AV', 'TxRx', '0a', '02', '02', 'Discrete', 2, '0'],
	['arcamInput.Video', 'PVR', 'TxRx', '0a', '03', '03', 'Discrete', 2, '0'],
	['arcamInput.Video', 'VCR', 'TxRx', '0a', '04', '04', 'Discrete', 2, '0'],
	['arcamInput.Video', 'GAME', 'TxRx', '0a', '05', '05', 'Discrete', 2, '0'],
	['arcamInput.Video', 'STB', 'TxRx', '0a', '06', '06', 'Discrete', 2, '0'],
	['arcamInput.Video', '?', 'TxRx', '0a', '07', '07', 'Discrete', 2, '0'],
	['arcamInput.Video', 'Req', 'Req', '0a', 'f0', 'f0', 'Discrete', 2, 'wr'],

	['arcamAudio.Mode.AnalogDigital', 'Analog', 'TxRx', '0b', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Mode.AnalogDigital', 'Digital', 'TxRx', '0b', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.AnalogDigital', 'HDMI', 'TxRx', '0b', '02', '02', 'Discrete', 1, '0'],
	['arcamAudio.Mode.AnalogDigital', 'Req', 'Req', '0b', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Mode.DirectMode', 0, 'TxRx', '0f', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DirectMode', 1, 'TxRx', '0f', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DirectMode', 'Req', 'Req', '0f', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Mode.DecodeMode.2Channel', 'Stereo', 'Rx', '10', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', 'Dolby Surround', 'Rx', '10', '04', '04', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', 'Neo:6 Cinema', 'Rx', '10', '07', '07', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', 'Neo:6 Music', 'Rx', '10', '08', '08', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', '5/7 Ch Stereo', 'Rx', '10', '09', '09', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', 'DTS Neural:X', 'Rx', '10', '0a', '0a', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.2Channel', 'Req', 'Req', '10', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Mode.DecodeMode.MultiChannel', 'Stereo down-mix', 'Rx', '11', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.MultiChannel', 'Multi-channel', 'Rx', '11', '02', '02', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.MultiChannel', 'DTS-ES / Neural:X', 'Rx', '11', '03', '03', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.MultiChannel', 'Dolby Surround', 'Rx', '11', '06', '06', 'Discrete', 1, '0'],
	['arcamAudio.Mode.DecodeMode.MultiChannel', 'Req', 'Req', '11', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamVideo.Mode.OutputResolution', 'SD Progressive', 'TxRx', '13', '02', '02', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', '720p', 'TxRx', '13', '03', '03', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', '1080i', 'TxRx', '13', '04', '04', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', '1080p', 'TxRx', '13', '05', '05', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', 'Preferred', 'TxRx', '13', '06', '06', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', 'Bypass', 'TxRx', '13', '07', '07', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', '4k', 'TxRx', '13', '08', '08', 'Discrete', 1, '0'],
	['arcamVideo.Mode.OutputResolution', 'Req', 'Req', '13', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamDisplay.Menu.Status.Status', 'No menu is open', 'Rx', '14', '00', '00', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Set-up Menu Open', 'Rx', '14', '02', '02', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Trim Menu Open', 'Rx', '14', '03', '03', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Bass Menu Open', 'Rx', '14', '04', '04', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Treble Menu Open', 'Rx', '14', '05', '05', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Sync Menu Open', 'Rx', '14', '06', '06', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Sub Menu Open', 'Rx', '14', '07', '07', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Tuner Menu Open', 'Rx', '14', '08', '08', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Network menu Open', 'Rx', '14', '09', '09', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'USB Menu Open', 'Rx', '14', '0a', '0a', 'Discrete', 1, '0'],
	['arcamDisplay.Menu.Status.Status', 'Req', 'Req', '14', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.Preset.CurrentPreset', 'VALUE', 'TxRx', '15', 'VALUE', 'VALUE', 'Special', 1, '0'],
	['arcamTuner.Preset.CurrentPreset', 'Req', 'Req', '15', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.Preset', 'VALUE', 'TxRx', '1b', 'VALUE', 'VALUE', 'Special', 1, '0'],
	['arcamTuner.Preset', 'Req', 'Req', '1b', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTuner.FM.Tune.Frequency', 'VALUE', 'Rx', '16', 'VALUE', 'VALUE', 'Special', 1, '0'],
	['arcamTuner.FM.Tune.Frequency', 'Req', 'Req', '16', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamTuner.FM.Tune.Ctl_Up', 1, 'TxCtl', '16', '01', '01', 'Control', 1, 'wr'],
	['arcamTuner.FM.Tune.Ctl_Down', 1, 'TxCtl', '16', '00', '00', 'Control', 1, 'wr'],

	['arcamTuner.FM.Scan.Ctl_Up', 1, 'TxCtl', '23', '01', '01', 'Control', 1, 'wr'],
	['arcamTuner.FM.Scan.Ctl_Down', 1, 'TxCtl', '23', '01', '01', 'Control', 1, 'wr'],
	['arcamTuner.FM.Scan.Active', 1, 'Rx', '23', 'ff', 'ff', 'Control', 1, 'wr'],

	['arcamAudio.Tone.Treble.Level', 'VALUE', 'TxRx', '35', 'VALUE', 'VALUE', 'Tone', 1, '0'],
	['arcamAudio.Tone.Treble.Level', 'Req', 'Req', '35', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.Tone.Treble.Ctl_Up', 1, 'TxCtl', '35', 'f1', 'f1', 'Control', 1, 'wr'],
	['arcamAudio.Tone.Treble.Ctl_Down', 1, 'TxCtl', '35', 'f2', 'f2', 'Control', 1, 'wr'],

	['arcamAudio.Tone.Bass.Level', 'VALUE', 'TxRx', '36', 'VALUE', 'VALUE', 'Tone', 1, '0'],
	['arcamAudio.Tone.Bass.Level', 'Req', 'Req', '36', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.Tone.Bass.Ctl_Up', 1, 'TxCtl', '36', 'f1', 'f1', 'Control', 1, 'wr'],
	['arcamAudio.Tone.Bass.Ctl_Down', 1, 'TxCtl', '36', 'f2', 'f2', 'Control', 1, 'wr'],

	['arcamAudio.Tone.Balance.Level', 'VALUE', 'TxRx', '3b', 'VALUE', 'VALUE', 'Tone', 1, '0'],
	['arcamAudio.Tone.Balance.Level', 'Req', 'Req', '3b', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.Tone.Balance.Ctl_Right', 1, 'TxCtl', '3b', 'f1', 'f1', 'Discrete', 1, 'wr'],
	['arcamAudio.Tone.Balance.Ctl_Left', 1, 'TxCtl', '3b', 'f2', 'f2', 'Discrete', 1, 'wr'],
	
	['arcamAudio.Subwoofer.Trim.Level', 'VALUE', 'TxRx', '3f', 'VALUE', 'VALUE', 'Tone', 1, '0'],
	['arcamAudio.Subwoofer.Trim.Level', 'Req', 'Req', '3f', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamAudio.Subwoofer.Trim.Ctl_Up', 1, 'TxCtl', '3f', 'f1', 'f1', 'Discrete', 1, 'wr'],
	['arcamAudio.Subwoofer.Trim.Ctl_Down', 1, 'TxCtl', '3f', 'f2', 'f2', 'Discrete', 1, 'wr'],
	
	['arcamTuner.DAB.Scan.Ctl_Start', 1, 'TxCtl', '24', 'f0', 'f0', 'Discrete', 1, 'wr'],
	['arcamTuner.DAB.Scan.Status', 1, 'Rx', '24', 'ff', 'ff', 'Discrete', 1, 'wr'],

	['arcamAudio.Mode.LipsyncDelay', 'VALUE', 'TxRx', '40', 'VALUE', 'VALUE', 'Numeric', 1, '0'],
	['arcamAudio.Mode.LipsyncDelay', 'Req', 'Req', '40', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Mode.Compression', 'Off', 'TxRx', '41', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Mode.Compression', 'Medium', 'TxRx', '41', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Mode.Compression', 'High', 'TxRx', '41', '02', '02', 'Discrete', 1, '0'],
	['arcamAudio.Mode.Compression', 'Req', 'Req', '41', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamVideo.Info.IncomingVideoMode', 'VALUE', 'Rx', '42', 'VALUE', 'VALUE', 'Special', 1, '0'],
	['arcamVideo.Info.IncomingVideoMode', 'Req', 'Req', '42', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Info.IncomingAudioFormat', 'VALUE', 'Rx', '43', 'VALUE', 'VALUE', 'Special', 1, '0'],
	['arcamAudio.Info.IncomingAudioFormat', 'Req', 'Req', '43', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamAudio.Info.Headphones.Status', 0, 'Rx', '02', '00', '00', 'Discrete', 1, '0'],
	['arcamAudio.Info.Headphones.Status', 1, 'Rx', '02', '01', '01', 'Discrete', 1, '0'],
	['arcamAudio.Info.Headphones.Status', 'Req', 'Req', '02', 'f0', 'f0', 'Discrete', 1, 'wr'],

	['arcamTest.Test1.Ctl_Test1', 'VALUE', 'Tx', 'ff', 'ff', 'ff', 'Discrete', 1, 'wr'],
	['arcamSystem.Info.Connected', 'VALUE', 'Tx', 'ff', 'ff', 'ff', 'Discrete', 1, 'wr'],
	['arcamSystem.Info.Connected', 'VALUE', 'Tx', 'ff', 'ff', 'ff', 'Discrete', 1, 'wr'],
	['arcamSystem.Info.Connected', 'VALUE', 'Tx', 'ff', 'ff', 'ff', 'Discrete', 1, 'wr'],
	
	
];

var ControlStateList = ['arcamTest.Test1.Ctl_Test1', 'arcamSystem.Info.Connected', 'arcamTuner.FM.Tune.Ctl_DirectTune'];

var audioStreamFormatTable = [
	//	Format Name						Data1
	['PCM', '00'],
	['Analogue Direct', '01'],
	['Dolby Digital', '02'],
	['Dolby Digital EX', '03'],
	['Dolby Digital Surround', '04'],
	['Dolby Digital Plus', '05'],
	['Dolby Digital True HD', '06'],
	['DTS', '07'],
	['DTS 96/24', '08'],
	['DTS ES Matrix', '09'],
	['DTS ES Discrete', '0a'],
	['DTS ES Matrix 96/24', '0b'],
	['DTS ES Discrete 96/24', '0c'],
	['DTS HD Master Audio', '0d'],
	['DTS HD High Res Audio', '0e'],
	['DTS Low Bit Rate', '0f'],
	['DTS Core', '10'],
	['PCM Zero', '13'],
	['Unsupported', '14'],
	['Undetected', '15'],
	['Dolby Atmos', '16'],
	['DTS:X', '17'],
];

var audioChannelConfigurationTable = [
	//	Format Name						Data1
	['Dual Mono', '00'],
	['Centre only', '01'],
	['Stereo only', '02'],
	['Stereo + mono surround', '03'],
	['Stereo + Surround L & R', '04'],
	['Stereo + Surround L & R + mono Surround Back', '05'],
	['Stereo + Surround L & R + Surround Back L & R', '06'],
	['Stereo + Surround L & R containing matrix information for surround back L&R', '07'],
	['Stereo + Centre', '08'],
	['Stereo + Centre + mono surround', '09'],
	['Stereo + Centre + Surround L & R', '0a'],
	['Stereo + Centre + Surround L & R + mono Surround Back', '0b'],
	['Stereo + Centre + Surround L & R + Surround Back L & R', '0c'],
	['Stereo + Centre + Surround L & R  containing matrix information for surround back L&R', '0d'],
	['Stereo Downmix Lt Rt', '0e'],
	['Stereo Only (Lo Ro)', '0f'],
	['Dual Mono + LFE', '10'],
	['Centre + LFE', '11'],
	['Stereo + LFE', '12'],
	['Stereo + single surround + LFE', '13'],
	['Stereo + Surround L & R + LFE', '14'],
	['Stereo + Surround L & R + mono Surround Back + LFE', '15'],
	['Stereo + Surround L & R + Surround Back L & R + LFE', '16'],
	['Stereo + Surround L & R + LFE', '17'],
	['Stereo + Centre + LFE containing matrix information for surround back L&R', '18'],
	['Stereo + Centre + single surround + LFE', '19'],
	['Stereo + Surround L & R + LFE (Standard 5.1)', '1a'],
	['Stereo + Centre + Surround L & R + mono Surround Back + LFE (6.1, e.g. DTS ES Discrete)', '1b'],
	['Stereo + Centre + Surround L & R + Surround Back L & R + LFE (7.1)', '1c'],
	['Stereo + Centre + Surround L & R + LFE, containing matrix information for surround back L&R (6.1 e.g. Dolby Digital EX)', '1d'],
	['Stereo Downmix (Lt Rt) + LFE', '1e'],
	['Stereo Only (Lo Ro) + LFE', '1f'],
	['Unknown', '20'],
	['Undetected', '21'],
];

var audioSampleRateTable = [
	['32', '00'],
	['44.1', '01'],
	['48', '02'],
	['88.2', '03'],
	['96', '04'],
	['176.4', '05'],
	['192', '06'],
	['unknown', '07'],
	['undetected', '08'],
];

var stringReplacementTable = [
	['ä', 'ae', '91', 'e4'],
	['ö', 'oe', '97', 'f6'],
	['ü', 'ue', '99', 'fc'],
	['Ä', 'Ae', '??', 'c4'],
	['Ö', 'Oe', '??', 'd6'],
	['Ü', 'Ue', '??', 'dc'],
	['ß', 'ss', '8d', 'df'],
];

var arcamStateList = create_arcamStateList(lookupTable); //create arcamStateList containing only the singular Statenames from lookupTable
var arcamPresetStateList = create_arcamPresetStateList('foo'); //create arcamPresetStateList containing only the PresetStatenames


adapter.on('message', function (obj) {
	adapter.log.debug("adapter.on-message: << MESSAGE >>");
});

adapter.on('ready', function () {
	adapter.log.debug("adapter.on-ready: << READY >>");
	main();
});

adapter.on('unload', function () {
	adapter.log.debug("adapter.on-unload: << UNLOAD >>");
});

adapter.on('stateChange', function (id, state) { //if adapter state changes do
	if (!id || !state || state.ack) {
		return;
	}

	var deleteStr = adapter.namespace + "."; // define string to be removed
	var idStateName = S(id).strip(deleteStr).s; // remove string
	
	foo: {
		if (idStateName.indexOf(".Ctl_") > -1) { // if stateName contains ".Ctl_" then change to Control handling
			adapter.log.debug("ControlState change: " + idStateName + " " + state.val);
			var controlReturn = control(idStateName, state.val);
		}
		if (controlReturn === 'exit') {
			break foo;
		}

		var split = split_StateName(idStateName); //extract zoneless idStateName and Zone. All Statenames for Zone 2 need to end with "2"
		idStateName = split[0];
		var Tx_Zn = split[1];

		// adapter.log.debug("Statename = " + idStateName);

		var lookupDataTx = lookupTx(idStateName, state.val, Tx_Zn, 'Tx', '0'); // look up Transmit Command Code ("Tx_Cc") and Transmit Data ("Tx_Data") from lookupTable //Prüfen: Übergabe von Tx_Zn überflüssig?
		if (typeof lookupDataTx[0] == "undefined") {
						adapter.log.debug("State not found");
						break foo;
					}
		var Tx_Cc = lookupDataTx[0]; // Tx_Cc is first Element in returned array
		var Tx_Data = lookupDataTx[1]; // Tx_Data is second Element in returned array
	
		var Tx_Data_Str = Tx_Data.toString(16); // convert Tx_Data to HEX
		var kannEntfallen = "";
		sendIP(Tx_Zn, Tx_Cc, kannEntfallen/*Tx_Dl*/, Tx_Data_Str); // send Data
	}

});


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
		requestStatus('PRESET');
		return 'exit';
		break;
	default:
		break;
	}
}

function sendIP(Tx_Zn, Tx_Cc, kannEntfallen/*Tx_Dl*/, Tx_Data_Str) { //send IP based on arguments
	if (Tx_Cc != 0xFF) //Prüfen ob überflüssig
	{
		const Tx_St = 0x21; // Arcam standard message Start-ID
		const Tx_Et = 0x0D; // Arcam standard message End-ID
		var Tx_Dl = dataLengthTx(Tx_Data_Str); // determine Data length
		var bufferSize = 4 + Tx_Dl + 1; // compute the required buffer length
		var buffer = new Buffer(bufferSize); //initialize Buffer
		buffer.writeUInt8(Tx_St, 0);
		buffer.writeUInt8(Tx_Zn, 1);
		Tx_Cc = parseInt(Tx_Cc, 16);
		buffer.writeUInt8(Tx_Cc, 2);
		buffer.writeUInt8(Tx_Dl, 3);
		for (var z = 0; z < Tx_Dl; z++) // fill Buffer with individual Bytes from Tx_Data_Str
		{
			var byteStart = 2 * z;
			var strSlice = Tx_Data_Str.slice(byteStart, byteStart + 2);
			var writeData = parseInt(strSlice, 16);
			adapter.log.debug('writeData: ' + writeData);
			buffer.writeUInt8(writeData, 4 + z);

		}

		buffer.writeUInt8(Tx_Et, 4 + Tx_Dl);
		if (connecting === false) {
			socketAVR.write(buffer); // write Buffer to IP socket
		} else {
			return "Tx error";
		}
	}
}


function requestStatus(requestStatusSelect) { // valid arguments: [AMP / PRESET / ALL /specific state]
	var scanAll = 0;
	switch (requestStatusSelect) {
		case 'ALL':
			scanAll = 1;
		case "AMP": // sequence of Requests if AMP-status is required
			var StateList = arcamStateList;
			let i = 0;
			let zoneCounter = 0;
			var Tx_Dl = 1;
			setTimeout(function requestLoopAMP() {
				if (i >= lookupTable.length) {
//					statusRequestActive = 0;
					if (scanAll == 1){
					requestStatus('PRESET');
					}
			return;
				} else {
					var mode = lookupTable[i][2];
					if (mode == 'Req'){
						var zonelessState = lookupTable[i][0];
						var zones = lookupTable[i][7];
						var Tx_Cc = lookupTable[i][3];
						if (zoneCounter != 1){
							zoneCounter = zones;
						}
						if (zoneCounter == 1){
							var Tx_Data = lookupTable[i][4];
							var Tx_Zn = '01';
						}
						if (zoneCounter == 2){
							var Tx_Data = lookupTable[i][5];
							var Tx_Zn = '02';
						}
						zoneCounter--;
						if (zoneCounter == 0){
							i++;
						}
						
						sendIP(Tx_Zn, Tx_Cc, Tx_Dl, Tx_Data);
						//adapter.log.debug(Tx_Zn + " " + Tx_Cc + " " + Tx_Dl + " " + Tx_Data_Str);
						adapter.log.debug("Status Request sent for: " + zonelessState + zoneCounter);
						
						var mumpitz = setTimeout(requestLoopAMP, 200);
					} else {
						i++;
						requestLoopAMP();
					}
				}
	}, 200);
			break;

		case "PRESET": // sequence of Requests if PRESET-status is required
			var StateList = arcamPresetStateList;
			let j = 1;
			setTimeout(function requestLoopPRESET() {
				if (j > qtyTunerPresets) {
				//if (j > StateList.length){
					statusRequestActive = 0;
					return;
				} else {
					var Tx_Zn = '01'; // always Zone 1
					var Tx_Cc = '1b'; // always '1b'
					var Tx_Dl = 1; // always '01'
					var Tx_Data_Str = j.toString(16); // increment Preset-Number with each loop
					//adapter.log.debug(Tx_Zn + " " + Tx_Cc + " " + Tx_Dl + " " + Tx_Data_Str);
					sendIP(Tx_Zn, Tx_Cc, Tx_Dl, Tx_Data_Str);
					adapter.log.debug("Status Request sent for Preset: " + j);
					j++;
				}
				setTimeout(requestLoopPRESET, 200);
			}, 200);

			break;
		case "ALL": // if complete Status is requested, call both AMP and PRESET options in sequence
			requestStatus("AMP");
			// requestStatus("PRESET");
			break;

			// NEU Abfrage eines einzelnen Status
		default:
			var isInArray = arcamStateList.includes(requestStatusSelect); //check if requestStatusSelect is valid state
			if (isInArray = true) {
				var StateName = requestStatusSelect;
				var Split = split_StateName(StateName);
				var ZonelessState = Split[0];
				var Tx_Zn = Split[1];
				var Request = lookupTx(ZonelessState, 'Req', Tx_Zn, 'Req', '0');
				//adapter.log.debug(StateList[i] + " " + 'Req'+ " " + Tx_Zn);

				if (typeof Request[0] == "undefined") {
					// adapter.log.debug(ZonelessState + " " + Tx_Zn);
					return;
				}

				var Tx_Cc = Request[0];
				var Tx_Data = Request[1];
				// adapter.log.debug("lookup TxData = " + Tx_Data + "/ Tx_Zn = " + Tx_Zn);
				var Tx_Data_Str = Tx_Data; //.toString(16);
				var Tx_Dl = 1;
				sendIP(Tx_Zn, Tx_Cc, Tx_Dl, Tx_Data_Str);
				//adapter.log.debug(Tx_Zn + " " + Tx_Cc + " " + Tx_Dl + " " + Tx_Data_Str);
				adapter.log.debug("Status Request sent for: " + StateName);
				break;
			} else {
				break;
			}
			//*/

	}
}




function create_arcamStateList(listTable) { //creates arcamStateList by filling an array with all States in lookupTable that have 'Rec'-Mode (all States).
	var StateArray = [];
	const findRequest = 'wr';
	const indexRequest = 8;
	var j = 0;

	for (var i = 0, L = listTable.length; i < L; i++) {
		if (listTable[i][indexRequest] === findRequest) {
		//folgendes statt obiger Zeile versuchen, da sicherer und r und w auch gefunden werden:
		//if (findRequest.indexOf(listTable[i][indexRequest]) > -1) {
		StateArray[j] = listTable[i][0];
			var n = StateArray[j]
			//adapter.log.debug("blabla");
			j++;
			if (listTable[i][7] === 2) {
				StateArray[j] = listTable[i][0] + "2";
				//adapter.log.debug(StateArray[j]);
				j++;
			}
		}
	}
	return StateArray;
}

function create_arcamPresetStateList(foo) { ////creates arcamPresetStateList by building an array with all States
	var PresetStateList = [];
	var str1 = "arcamTuner.Preset.";
	var str3Array = [".Band", ".StationName"];
	var k = 0;
	for (var i = 1; i <= 50; i++) {
		var str2 = i + "";
		str2 = S(str2).padLeft(2, 0).s;
		for (var j = 0; j < str3Array.length; j++) {
			var str3 = str3Array[j];
			var PresetStateName = str1 + str2 + str3;
			PresetStateList[k] = PresetStateName;
			k++;
		}
	}
	return PresetStateList;
}

function split_StateName(nameStr) { //extract zoneless idStateName and Zone. All Statenames for Zone 2 need to end with "2"
	var lastChr = nameStr.substring(nameStr.length - 1, nameStr.length); //get last character of idStateName
	if (lastChr == "2") //if lastChr = "2" then assign Zone 2
	{
		var ZoneSplit = 0x02;
		var ZonelessStateName = nameStr.substr(0, nameStr.length - 1); //delete last chr of nameStr so that states do not have to be duplicated for Zone 1 and 2 in switch - case
	} else { //if not "2" then assign Zone 1
		var ZoneSplit = 0x01;
		var ZonelessStateName = nameStr;
	}
	return [ZonelessStateName, ZoneSplit];
}

function dataLengthTx(data) { //determine Data length
	if (data.length % 2 !== 0) {
		return (data.length + 1) / 2; //if odd, then add 1 and divide by 2. odd number possible because e.g. 0x0b translates to 'b'
	} else {
		return (data.length) / 2; //if even, then divide by 2
	}
}

function lookupTx(stName, stValue, zone, Mode, Egal) { //look up data required to build outgoing IP-Message

	var find1 = stName;
	var index1 = 0;

	var find2a = stValue;
	var find2b = 'VALUE';
	var index2 = 1;

	var find3 = Mode;
	var index3 = 2;

	var ResultArray = searchList(lookupTable, find1, index1, find2a, find2b, index2, find3, index3);

	var Tx_Cc = ResultArray[3];

	if (zone == 0x01) {
		var Tx_Data = ResultArray[4];
	} else {
		var Tx_Data = ResultArray[5];
	}

	switch (ResultArray[6]) {
	case 'Numeric':
		break;

	case 'Tone':
		if (0 <= stValue && stValue <= 20) {
			stValue = stValue;
		}
		if (0 > stValue && stValue >= -20) {
			stValue = ((-1) * stValue) + 128;
		}
		if (stName == "arcamAudio.Subwoofer.Trim"){
			stValue = stValue * 2; // compensation for 0.5dB steps
		}
		adapter.log.debug("send tone: " + stValue);
		break;
	default:
		break;

	case 'Volume':
		switch (zone)
		{
			case 0x01:
				stValue = limitVolumeStep(stValue, currentVolume);		
				//currentVolume = stValue;
			break;
			case 0x02:
				stValue = limitVolumeStep(stValue, currentVolume2);		
				//currentVolume2 = stValue;
			break;
		}
		break;
	}
	if (Tx_Data === 'VALUE') {
		Tx_Data = stValue
	};
	var Zones = ResultArray[7];
	return [Tx_Cc, Tx_Data, Zones];

}

function lookupRx(Rx_Cc, Rx_Data, Rx_Zn, Mode, Rx_Dl) { //look up data required to decode incoming IP-Message

	var find1 = Rx_Cc;
	var index1 = 3;

	var find2a = Rx_Data;
	var find2b = 'VALUE';
	if (Rx_Zn == '01') {
		var index2 = 4;
	} else {
		var index2 = 5;
	}

	var find3 = Mode;
	var index3 = 2;

	var ResultArray = searchList(lookupTable, find1, index1, find2a, find2b, index2, find3, index3);

	var stateName1 = ResultArray[0];
	var stateVal1 = ResultArray[1];
	var dataType = ResultArray[6];
	var stateName2;
	var stateVal2;
	var stateCount = 1;

	if (stateVal1 === 'VALUE') {
		stateVal1 = Rx_Data
	};
	switch (dataType) {
	case "Numeric":
		stateVal1 = parseInt(stateVal1, 16);
		break;

	case "ASCII":
		stateVal1 = hex2ascii(stateVal1, 16);
		break;

	case "Volume":
		stateVal1 = parseInt(stateVal1, 16);
	switch (Rx_Zn)
		{
			case '01':
				currentVolume = stateVal1;
			break;
			case '02':
				currentVolume2 = stateVal1;
			break;
		}
	break;
	case "Tone":
		var toneRaw = parseInt(stateVal1, 16);
		if (0 <= toneRaw && toneRaw <= 15) {
			stateVal1 = toneRaw;
		}
		if (129 <= toneRaw && toneRaw <= 143) {
			stateVal1 = (-1) * (toneRaw - 128)
		}
		if (stateName1 == "arcamAudio.Subwoofer.Trim"){
			stateVal1 = stateVal1 / 2; // only 0,5dB steps as opposed to bass, treble, etc.
		}
		adapter.log.debug("Tone: " + stateVal1);
		break;

		case "Special":
		switch (stateName1) {
		case "arcamTuner.Preset.CurrentPreset":
			switch (Rx_Data) {
			case "ff":
				stateVal1 = "Currently no preset selected";
				break;
			default:
				var Rx_Data_Int = parseInt(Rx_Data, 16)
					stateVal1 = Rx_Data_Int;
				break;
			}
			break;

		case "arcamTuner.Preset":
			var PresetNumber = parseInt(stateVal1.slice(0, 2), 16);
			var PresetNumber = S(PresetNumber).padLeft(2, 0).s;
			var DetailTypeRaw = stateVal1.slice(2, 4);
			var Data3 = stateVal1.slice(4, 6);
			var Data4 = stateVal1.slice(6, 8);
			var StrLength = (2 * Rx_Dl) - 4;
			var Data_n = stateVal1.slice(4, 4 + StrLength);

			// vereinfacht probieren:sollte reichen, da ab position 4 ausgeschnitten wird
			// wenn geht, Rx_Dl rausschmeissen und auch nicht an die funktion lookup übergeben. Folgendes kann dann auch unter "adapter.on(data)..." entfallen:
			//var Rx_Dl_Hex = response[i].substr(8, 2); //DataLength Hex: Anzahl der Bytes
			//var Rx_Dl_Chr = parseInt(Rx_Dl_Hex, 16); //DataLength Chr: Anzahl der Zeichen

			/*
			var Data_n = stateVal1.slice(4);
			 */

			const DetailType1 = "Band"; //"DAB or FM"
			var DetailData1;
			const DetailType2 = "StationName"; //DAB-Data or RDS
			var DetailData2;

			switch (DetailTypeRaw) {
			case "01":
				DetailData1 = "FM";
				DetailData2 = data2frequencyStr(Data3, Data4); //parseInt(Data3, 16) + "." + parseInt(Data4, 16) + " MHz";
				break;
			case "02":
				DetailData1 = "FM";
				DetailData2 = hex2ascii(Data_n);
				break;
			case "03":
				DetailData1 = "DAB";
				DetailData2 = hex2ascii(Data_n);
				break;
			}
			stateName1 = 'arcamTuner.Preset' + "." + PresetNumber + "." + DetailType1;
			stateVal1 = DetailData1;
			stateName2 = 'arcamTuner.Preset' + "." + PresetNumber + "." + DetailType2;
			stateVal2 = DetailData2;
			stateCount = 2;
			break;

		case "arcamVideo.Info.IncomingVideoMode":
			var resolutionHorizontal = parseInt(stateVal1.slice(0, 4), 16);
			var resolutionVertical = parseInt(stateVal1.slice(4, 8), 16);
			var refreshRate = parseInt(stateVal1.slice(8, 10), 16);
			var interlaced = stateVal1.slice(10, 12);
			switch (interlaced) {
				case '00':
					interlaced = 'p';
					break;
				case '01':
					interlaced = 'i';
					break;
				default:
					break;
				}
			var aspectRatio = stateVal1.slice(12, 14);
			switch (aspectRatio) {
				case '00':
					aspectRatio = 'undefined';
					break;
				case '01':
					aspectRatio = '4:3';
					break;
				case '02':
					aspectRatio = '16:9';
					break;
				default:
					break;
				}
			var incomingVideoModeStr = resolutionHorizontal + 'x' + resolutionVertical + interlaced + ' ' + refreshRate + ' Hz ' + aspectRatio;
			stateVal1 = incomingVideoModeStr;
			break;

		case "arcamAudio.Info.IncomingAudioFormat":
			var Data1 = stateVal1.slice(0, 2);
			var Data2 = stateVal1.slice(2, 4);
			var lookupData1 = searchList(audioStreamFormatTable, Data1, 1, Data1, Data1, 1, Data1, 1);
			var lookupData2 = searchList(audioChannelConfigurationTable, Data2, 1, Data2, Data2, 1, Data2, 1);
			Data1 = lookupData1[0];
			Data2 = lookupData2[0];
			var incomingAudioFormat = Data1 + " / " + Data2;
			stateVal1 = incomingAudioFormat;
			break;

		case "arcamAudio.Info.IncomingAudioSampleRate":
			var Data1 = stateVal1;
			var lookupData1 = searchList(audioSampleRateTable, Data1, 1, Data1, Data1, 1, Data1, 1);
			Data1 = lookupData1[0];
			var audioSampleRate = Data1 + " kHz";
			stateVal1 = audioSampleRate;
			break;

		case "arcamTuner.FM.Tune.Frequency":
			var currentMHz = stateVal1.slice(0, 2);
			var currentkHz = stateVal1.slice(2, 4);
			currentFrequencyStr = data2frequencyStr(currentMHz, currentkHz, 'digits'); //parseInt(currentMHz, 16) + "." + parseInt(currentkHz, 16) + " MHz";currentFrequencyStr;
			stateVal1 = data2frequencyStr(currentMHz, currentkHz, 'string');
			break;

		default:
			break;

		}
	default:
		break;
	}

	if (Rx_Zn == 0x02) {
		stateName1 = stateName1 + '2'
	};
	return [stateName1, stateVal1, stateName2, stateVal2, stateCount];
}

function searchList(listName, param1, offset1, param2a, param2b, offset2, param3, offset3) { //find: 1 && 2a||2b && 3

	var compare1,
	compare2,
	compare3;

	for (var i = 0, L = listName.length; i < L; i++) {
		compare1 = listName[i][offset1];
		compare2 = listName[i][offset2];
		compare3 = listName[i][offset3];
		if ((compare1 === param1) && ((compare2 == param2a) || (compare2 == param2b)) && (compare3.indexOf(param3) > -1)) {
			return listName[i]
		}
	}
	return '';
}

function data2frequencyStr(data1, data2, type) {
	var frequencyStr = parseInt(data1, 16) + "" + S(parseInt(data2, 16) + "").padLeft(2, 0); // Testweise ohne . und MHz
	switch (type) {
	case 'digits':
		var frequencyStr = parseInt(data1, 16) + "" + S(parseInt(data2, 16) + "").padLeft(2, 0);
		break;
	case 'string':
		var frequencyStr = parseInt(data1, 16) + "." + S(parseInt(data2, 16) + "").padLeft(2, 0) + " MHz";
		break;
	}
	return frequencyStr;
}

function connectToArcam(host) {
	socketAVR = net.connect({
			port: 50000,
			host: host
		}, function () {
			adapter.log.debug("adapter connected to ARCAM-AVR: " + host + ":" + "50000");
		});
	connecting = false;
	adapter.log.debug(host + ":" + port);
	//autoRequest();
	
	function restartConnection() {
		adapter.log.warn("function restart connection called");
		adapter.setState("arcamSystem.Info.Connected", {
			val: 0,
			ack: true
		});
		if (socketAVR) {
			socketAVR.end();
			socketAVR = null;
		}
		if (!connecting) { // try to reconnect every 10 seconds
			adapter.log.warn("restart connection to Arcam-AVR");
			connecting = setTimeout(function () {
					connectToArcam(host);
				}, 10000);
		}
	}

	//
	// probieren, ob man das nachfolgende nicht aus der function connectToArcam ausgliedern kann
	//

	socketAVR.on('connect', function() {
		autoRequest();
		adapter.setState("arcamSystem.Info.Connected", {
		val: 1,
		ack: true
	});
	});
	
	socketAVR.on('error', restartConnection);

	socketAVR.on('close', restartConnection);

	socketAVR.on('end', restartConnection);

	socketAVR.on('data', function (data) {
		var dataStr = data.toString('hex');
		//adapter.log.info("data from " + adapter.config.host + ": *" + dataStr + "*");

		var byteLength = data.byteLength;

		var response = dataStr.split("\r");
		//
		// Response-Auswertung in eigene Funktion verschieben
		//

		for (var i = 0; i < response.length; i++) {
			var Rx_St = response[i].substr(0, 2); //Start-Byte
			var Rx_Zn = response[i].substr(2, 2); //Zone
			var Rx_Cc = response[i].substr(4, 2); //CommandCode
			var Rx_Ac = response[i].substr(6, 2); //AnswerCode
			var Rx_Dl_Hex = response[i].substr(8, 2); //DataLength Hex: Anzahl der Bytes
			var Rx_Dl_Chr = parseInt(Rx_Dl_Hex, 16); //DataLength Chr: Anzahl der Zeichen
			var Rx_Data = response[i].slice(10, -2); //Data
			var Rx_Et = response[i].slice(-2); //End Transmission


			adapter.log.debug("debug: *" + "Rx_St: " + Rx_St + " Rx_Zn: " + Rx_Zn + " Cc: " + Rx_Cc + " Rx_Ac: " + Rx_Ac + " Rx_Dl: " + Rx_Dl_Chr + " Rx_Data: " + Rx_Data + " Rx_Et:" + Rx_Et + "* ");

			if (Rx_St == "21" && Rx_Ac == "00" && Rx_Et == "0d") // Check Start- and EndByte and Answer Code
			{
				var stateName;
				var stateVal;
				var zoneName;
				var lookupDataRx = lookupRx(Rx_Cc, Rx_Data, Rx_Zn, "Rx", Rx_Dl_Chr);
				if (lookupDataRx == null) {
					adapter.log.debug("Message Code not implemented yet");
				}
				var stateName = lookupDataRx[0];
				var stateVal = lookupDataRx[1];
				var stateName2 = lookupDataRx[2];
				var stateVal2 = lookupDataRx[3];
				var stateCount = lookupDataRx[4];

				adapter.setState(stateName, {
					val: stateVal,
					ack: true
				});
				adapter.log.debug("State " + stateName + " set with value " + stateVal);
				if (stateCount === 2) {
					adapter.setState(stateName2, {
						val: stateVal2,
						ack: true
					});
					adapter.log.debug("State2 " + stateName2 + " set with value " + stateVal2);
				}

			} else {
				switch (Rx_Ac) {
				case "82":
					adapter.log.debug("Zone invalid");
					break;
				case "83":
					adapter.log.debug("Command not recognized");
					break;
				case "84":
					adapter.log.debug("Parameter not recognized");
					break;
				case "85":
					adapter.log.debug("Command invalid at this time");
					break;
				case "86":
					adapter.log.debug("Invalid data length");
					break;
				default:
					break;
				}
			}
		}
	})
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
	//
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}


function fixSpecialCharacters(text) {
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

function subcribeStates(List) { // subscribe to required states
	var i = 0;
	for (i = 0; i < List.length; i++) {
		var stateForSubscription = List[i];
		adapter.subscribeStates(stateForSubscription);
		adapter.log.debug(stateForSubscription);
	}
}

function createStatesIfNotExist(List, ReadWrite) { // create states if they do not exist yet
	var readable = false;
	var writable = false;
	if (ReadWrite.indexOf('r') > -1) {
		readable = true;
	}
	if (ReadWrite.indexOf('w') > -1) {
		writable = true;
	}

	for (var i = 0; i < List.length; i++) {
		var name = List[i];
		adapter.setObjectNotExists(name, {
			type: 'state',
			common: {
				name: name,
				desc: name,
				type: 'string',
				read: readable,
				write: writable
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
	
	var currentFrequency = S(currentFrequencyStr).strip(' ', '_', ',', '.', ':', 'MHz').s; // strip delimiters
	currentFrequency = parseInt(currentFrequencyStr, 10);  // convert to Integer

	if ((directTuneFrequency < 8750) || (directTuneFrequency > 10800)) { // check if in allowed range
		adapter.log.debug("invalid Tuning Frequency");
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
	tuningSteps = deltaFrequency / 5;
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
			sendIP(FMzone, '16', 0x01, tuningDirectionData);
			i++;
			adapter.log.debug("counter= " + i);
		}
		setTimeout(sendTuneCommand, 250);
	}, 250);
}


function limitVolumeStep(targetVol, currentVol){
// limits the maximum (positive) volume step to xdB, defined by volumeStepLimit. Avoids accidental increases and potential damage to speakers
// var volumeStepLimit = 10; //e.g. 10dB max step
if ((targetVol - currentVol) > volumeStepLimit){
	adapter.log.debug('Target Volume: ' + targetVol + "/" + 'Current Volume: ' + currentVol);
	var filteredVolume = currentVol + volumeStepLimit;
	adapter.log.debug('Filtered Volume: ' + filteredVolume);
	} else {
	var filteredVolume = targetVol;
}
return filteredVolume;
}

function main() {
	
	adapter.log.debug("adapter.main: << MAIN >>");
	host = adapter.config.host;
	port = 	adapter.config.port;
	qtyTunerPresets = parseInt(adapter.config.qtyTunerPresets);
	volumeStepLimit = parseInt(adapter.config.volumeStepLimit);
	smoothVolRiseTime = parseInt(adapter.config.smoothVolRiseTime);
	smoothVolFallTime = parseInt(adapter.config.smoothVolFallTime);
	softMuteRiseTime = parseInt(adapter.config.softMuteRiseTime);
	softMuteFallTime = parseInt(adapter.config.softMuteFallTime);
	stepMuteAttenuation = parseInt(adapter.config.stepMuteAttenuation);
	connectToArcam(host);
	createStatesIfNotExist(arcamPresetStateList, 'r');
	createStatesIfNotExist(arcamStateList, 'wr');
	createStatesIfNotExist(ControlStateList, 'wr');
	adapter.subscribeStates('*'); // subscribe to all states inside the adapter's namespace
	statesReady = 1;
	// requestStatus('AMP');
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
Einführen globale Variable currentVolume und currentVolume2, wird bei Volumeänderung laufend aktualisiert
Einführen globale Variable volumeMemory und volumeMemory2, wird nur zu Beginn eines Ramp-Vorgangs beschrieben

Konfiguration: softVolumeRampTime // '0' = OFF
Konfiguration: softMuteRampTime // '0' = OFF
Konfiguration: fixedMuteLevel // e.g. 20dB
(Konfiguration: bei fixedMuteLevel Display blinken yes/no)

SoftVolume: hole currentVolume & targetVolume
(bei SoftMute: targetVolume = '0')
(bei muteFixedLevel: targetVolume = currentvolume - fixedMuteLevel)

volumeMemory = currentVolume // define startlevel // to memorize last "normal" volume for later resume
numberOfSteps = Runden (rampTime / requiredMessageDelay); // determine no of Steps based on desired ramp time and required message delay time
an dieser Stelle rampTime je nach aktivierter Funktion wählen (softMute oder softVolume)

softVolumeStep = Runden((targetVolume - currentVolume) / numberOfSteps) // aktuelle Lautstärke und runde auf Ganzahl(5 Schritte als Beispiel, ausprobieren was gut geht)

softVolumeLevel = currentVolume // define startlevel
von 1 bis (numberOfSteps - 1 ) sende softVolumeVolume = (softVolumeLevel + softVolumeStep) // wenn softVolumeStep negativ: reduzierung, sonst erhöhung
bei erreichen numberOfSteps sende targetVolume // to compensate for rounding errors
nur bei Mute und nur für Zone1 Lautsprecherrelais aktivieren
Gimmick nur bei muteFixedLevel: Display blinken lassen

bei MuteOff das ganze rückwärts


Mögliche Fallstricke: evtl. müssen während Ramp die emfangenen Volume messages ignoriert werden

*/

