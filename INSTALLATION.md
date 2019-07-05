# Iron Plaid Timeclock - Manual Installation

The scripted install is recommended, but on the chance you need to perform some of the install manually, the following are effectively the steps involved and are in fact what are accomplished via the script.
___
[Hardware](#hardware) | [Operating System](#operating-system) | [Display](#display) | [Node.js](#node.js) | [Database](#database) | [WiFi](#wifi) | [App Installation](#app-installation) | [Autostart](#autostart)
___
## Hardware
- [Raspberry Pi Model 3 B or B+](https://www.raspberrypi.org/products/)
- [7" Raspberry Pi LCD](https://www.raspberrypi.org/products/raspberry-pi-touch-display/)
- SD card (32 GB or more recommended)
- USB keyboard and mouse (at least for initial setup)
- (Optional) [Pimoroni Speaker pHAT](https://shop.pimoroni.com/products/speaker-phat)

## Operating System
The app has been tested on [Raspbian Stretch](https://www.raspberrypi.org/downloads/raspbian/) version 4.14.  Use either image "with desktop".

1. Initial startup - follow prompts
    1. update country, language, and timezone
    2. set up a password (take note of this password)
    3. join wifi
    4. (Optional) Install updates when prompted
2. restart

## Display
### Auto-hide the taskbar ([reference](https://raspberrypi.stackexchange.com/questions/8874/how-do-i-auto-hide-the-taskbar))
_This is necessary for the timeclock app to be able to use the full screen.  This currently has to be done manually._

1. Right-click on the taskbar and select "Panel Settings"
2. Click on the "Advanced" tab
3. Check "Minimize panel when not in use"
4. Set "Size when minimized" to 0

### Rotate the LCD
_This is only necessary if the case mounts with the microUSB ports on top._
```bash
printf "\nlcd_rotate=2" | sudo tee -a /boot/config.txt
```

### Update permissions to allow LCD brightness adjustment
```bash
sudo chmod o+w /sys/class/backlight/rpi_backlight/brightness
```

### Hide the mouse cursor & disable screen sleep
_A cursor looks out of place on a touchscreen, but you might want to wait to do this until you're done with the rest of the setup._
```bash
sudo sed -i 's/#xserver-command=X/xserver-command=X -core -nocursor -s 0 -dpms/g' /etc/lightdm/lightdm.conf
```

## Node.js
As the runtime engine for the app, Node.js needs to be installed.
```bash
sudo apt-get update
curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
sudo apt-get install -y nodejs
```
Confirm node and npm are working by checking their versions
```bash
node -v
npm -v
```

## Database
The app uses MySQL for the database, so we need to install MySQL, create the database user and tables, and manually add at least one mentor team member to allow administration.
### Install MySQL
```bash
sudo apt-get install -y mysql-server
```

### Case Insensitivity
To make your life a little easier, recommend you configure case insensitivity.
```bash
printf "[mysqld]\nlower_case_table_names=1" | sudo tee -a /etc/mysql/my.cnf
sudo /etc/init.d/mysql restart
```

### Create Database User and Tables
_Below is practically a script, but you'll need to replace \<user\> and \<password\> with those you choose to use, so don't just copy/paste._

```bash
sudo mysql -p -u root
```

```sql
CREATE USER '<user>'@'localhost' IDENTIFIED BY '<password>';
CREATE DATABASE timeclock;
GRANT ALL PRIVILEGES ON timeclock.* TO '<user>'@'localhost' IDENTIFIED BY '<password>';
FLUSH PRIVILEGES;

USE timeclock;

CREATE TABLE teammembers (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lastname VARCHAR(25) NOT NULL,
    firstname VARCHAR(25) NOT NULL,
    email VARCHAR(255) DEFAULT '',
    role VARCHAR(10) DEFAULT 'student',
    passcode VARCHAR(256) DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    deleted BOOLEAN DEFAULT FALSE,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

create table punches (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    memberid SMALLINT UNSIGNED NOT NULL,
    punchtype TINYINT(1) NOT NULL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
```

### Create Default Mentor
```sql
INSERT INTO teammembers (firstname, lastname, role, passcode)
VALUES ('Default', 'Mentor', 'mentor', SHA2('5555','256'));
```

Once additional mentors have been added, _**deactivate the default mentor entry**_.

### Secure MySQL
Initially, the MySQL installation is somewhat unsecure.  Take the following steps to [secure the installation](https://dev.mysql.com/doc/refman/8.0/en/default-privileges.html).
```bash
sudo mysql_secure_installation
```

Answer 'y' to all prompts:
1. Set root password to something of your choosing
2. Remove anonymous users
3. Disable root login remotely
4. Remove test database and access to it
5. Reload privilege tables

## App Installation
The following instructions walk you through installation using the latest release from the repo.  Alternatively, you can build the app on the RPi - see [Build and Deployment Workflow](RPIBUILD.md).

### Application executable
1. Download the latest .AppImage file from [releases](releases)
2. Copy the .AppImage file to the pi user's root folder (~/)
3. Rename the .AppImage file to "iptimeclock"
4. Make the "iptimeclock" file executable:
    ```bash
    chmod +x ~/iptimeclock
    ```

### Application configuration
1. Download all files from the 'config' folder in the repo
2. Make a new directory in the pi user's .config folder:
    ```bash
    mkdir ~/.config/iptimeclock
    ```
3. Copy all config files to ~/.config/iptimeclock
4. Create a file named 'key.txt' in this directory containing your decryption key (see below)

    #### config.json
    Database credentials, email server details, and wifi connection details are stored in this file.  Most values are encrypted (see below).

    #### encrypt.js
    This script helps encrypt values that will be placed in config.json.  Read comments in the script file for usage instructions.

    #### key.txt
    The file key.txt contains the private key needed to decrypt config.json entries.  In order to maintain security of the information mentioned above, this file is purposefully not included in the repo.  You'll need to get this key through some other means (talk to your mentors).  If you fork and modify this project <span style="color:red">**DO NOT STORE KEY.TXT IN YOUR REPO**</span>.

### First-time startup
Start the app by opening a terminal window and typing:
```bash
./iptimeclock
```
The first time you start the app, the Raspberry Pi will display a prompt, the buttons for which will not likely be visible - just hit Enter.

## Autostart
We want the timeclock to start up at boot time.
```bash
mkdir ~/.config/autostart
printf "[Desktop Entry]\nType=Application\nName=iptimeclock autostart\nComment=Iron Plaid Timeclock\nNoDisplay=false\nExec=/home/pi/iptimeclock" > ~/.config/autostart/iptimeclock.desktop
```

## WiFi
The app uses [RPi NetworkManager CLI](http://www.intellamech.com/RaspberryPi-projects/rpi_nmcli.html) to attempt to automatically connect to wifi for certain features.

```bash
sudo apt-get update
sudo apt-get install -y network-manager
sudo systemctl disable dhcpcd
sudo systemctl stop dhcpcd
sudo reboot
```

_Note: This will disable the regular wifi controls, so if you need to use the command line to connect or disconnect wifi._

### Additional OS configuration
```bash
printf "sudo chmod o+w /sys/class/backlight/rpi_backlight/brightness" >> ~/.bashrc
printf "alias dir='ls -alF'" >> .bash_aliases
sudo raspi-config nonint do_ssh 0
sudo raspi-config nonint do_vnc 0
sudo raspi-config nonint do_hostname iptimeclock
```

After restart, you'll need to connect to wifi manually:
```bash
nmcli dev wifi con "ssid" password "p455w04d"
````