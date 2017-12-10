![Logo](img/arcam.png)
# ioBroker.arcam

This adapter allows control of ARCAM AVRs via TCP/IP using port 50000.

Still buggy and missing error handling.

Currently the most important features are implemented, I have used the following Arcam-document as a reference:

* RS232_860_850_550_390_250_SH274E_C_091116.pdf

This file is available for download on the Arcam website.

## Additional Features:

### Autocreation of states

On startup the adapter checks if the required states exist, if not, these are created by the script.

### Autorequest
After verifying/creating the states and after each connect, update requests are sent to the AVR for all implemented states.

Every State with "Ctl_" in the statename is intended to be used with a pushbutton or text widget, e.g. "arcamAudio.Tone.Treble.Ctl_Up" to increment the treble level by 1dB each time the button is activated. 

### Direct FM Tuning
Arcam does not offer a direct tune feature for FM, neither via remote control, nor via IP command.
I have implemented a function to "simulate" direct tuning.
Entering an FM frequency into a text widget connected to the state "arcamTuner.FM.Tune.Ctl_DirectTune" will start the tuning to reach the target frequency.
The target frequency can be entered with or without delimiter and with or without trailing "0".
Unfortunately the ARCAM only allows tuning in 0.05 MHz steps and needs time between IP-messages to react. Therefore the tuning process is rather slow, but still better than manual tuning via remote...

### Limit Volume (increase) Steps
Volume steps initiated through a script or via a Vis-Widget can be limited to a configurable number of decibels (Adapter Configuration dialog: default: 10 / disable with 100).
This means that any request for a single volume step exceeding 10dB will be limited to said 10dB.
This feature is useful to prevent accidentally blowing your speakers... 

### Smooth Volume
Smooth Volume prevents rough volume steps by interpolating between current and target volume.
not implemented yet.

### Soft Mute
Similar to Smooth Volume, but with target Volume "0" and resume to previous volume.
not implemented yet.

### Step Mute
Decreases Volume by a configurable number of decibels (Adapter Configuration dialog: default: 20 / disable with 100)
not implemented yet.

### Autodiscover:
not implemented yet.



The implementation concentrates on the most important control functions. 

### 0.0.1
* initial version

### 0.0.2
arcam.js:
clean up code and comments
fix autoRequest
fix Volume2
fix Limit Volume (increase) Steps
add config parameters

io-package.json:
add config parameters

index.html
add config parameters

