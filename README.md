# Iron Plaid Timeclock - Raspberry Pi Edition

This timeclock app is built on [Electron](https://electronjs.org/), an open-source framework developed and maintained by GitHub.  Electron allows you to build cross-platform desktop apps using web technologies.  It uses Chromium, an open-source version of Google Chrome, for the user interface and Node.js, an open-source, cross-platform JavaScript run-time environment.

The app technically works fine on Windows, but is specifically designed and intended for use on a Raspberry Pi with touchscreen.

## Hardware
Used as-is, this app is intended to run on a Raspberry Pi with touchscreen LCD, so the following is the recommended hardware.
- [Raspberry Pi Model 3 B or B+](https://www.raspberrypi.org/products/) (not yet tested on Raspberry Pi 4)
- [7" Raspberry Pi LCD](https://www.raspberrypi.org/products/raspberry-pi-touch-display/)
- SD card (32 GB or more recommended)
- USB keyboard and mouse (at least for initial setup)
- (Optional) [Pimoroni Speaker pHAT](https://shop.pimoroni.com/products/speaker-phat)

## Operating System
The app has been fully tested on [Raspbian Stretch](https://www.raspberrypi.org/downloads/raspbian/) version 4.14 (with Desktop).  Some testing has been done on Raspbian Buster, but not complete.

## Installation and Setup
You're recommended to use the install bash script in the [config](config) folder.  The script assumes a fresh Raspbian installation.
1. Copy the [install.sh](config/install.sh) file to the boot folder on the SD card 
2. (Optional) Create a file key.txt in the boot folder on the SD card that contains the private encryption key
3. Boot the Raspberry Pi and after intial OS configuration, run the install script
```bash
/boot/install.sh
```

Should you want to manually perform any of the steps, see the [Installation Instructions](INSTALLATION.md).

## Long Term Maintenance
Whether performing manual installation and setup, or accessing the RPi for long-term maintenance and application modifications, please review the [Build and Deploy Workflow](BUILD.md) documentation, notably the [Useful Tools](BUILD.md#useful-tools) section.

