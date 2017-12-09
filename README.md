![Logo](img/arcam.png)
# ioBroker.arcam

This adapter allows control of ARCAM AVRs via TCP/IP using port 50000.

I have made this adapter for my personal use and thought I might share it.
I am not a professional software programmer so the code is definetely not "best practice".

Currently the most important features are implemented, I have used the following Arcam-document as a reference:

* RS232_860_850_550_390_250_SH274E_C_091116.pdf

This file is available for download on the Arcam website.

## Features:

### Autocreation of states

On startup the adapter checks if the required states exist, if not, these are created by the script.

### Autorequest
After verifying/creating the states, update requests are sent to the AVR for all implemented states.



Every State with "Ctl_" in the statename is intended to be used with a pushbutton or text widget, e.g. "arcamAudio.Tone.Treble.Ctl_Up" to increment the treble level by 1dB each time the button is activated 


### Additional features:

Arcam does not offer a direct tune feature for FM, neither via remote control, nor via IP command.
I have implemented a function to "simulate" direct tuning.
Entering an FM frequency into a text widget connected to the state "arcamTuner.FM.Tune.Ctl_DirectTune" will start the tuning to reach the target frequency.
The target frequency can be entered with or without delimiter and with or without trailing "0".
Unfortunately the ARCAM only allows tuning in 0.05 MHz steps and needs time between IP-messages to react. Therefore the tuning process is rather slow.
But anyway, I kept it just for the fun of it :-)
A possible usecase would be a later implementation of a preset file in text form, the Arcam automatically tuning to the frequency and storing the station on the predetermined Preset number.

Autodiscover:
planned, but not implemented yet.



The implementation concentrates on the most important control functions. 
The document "Steuerungsprotokoll_IP_RS232C_AVR-X1200W_AVR-X2200W_AVR-X3200W_AVR-X4200W.pdf" is beeing used as a reference guide.

### 0.0.1
* initial version
