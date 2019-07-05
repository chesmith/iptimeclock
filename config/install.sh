#!/bin/bash

echo "Before you run this script, you need to manually set the taskbar to autohide."
echo "  1. Right-click on the taskbar and select Panel Settings"
echo "  2. Click on the Advanced tab"
echo "  3. Check 'Minimize panel when not in use'"
echo "  4. Set 'Size when minimized' to 0"
echo ""
echo "Have you done this? (y/N)"
read reply
echo ""

if [ "$reply" == "" ] || [ "$reply" == "n" ] || [ "$reply" == "N" ]; then
    exit 1
fi

read -p "GitHub repository name......: " repo
echo ""
read -p "App database user ID........: " dbuser
echo ""
read -p "App database user password..: " dbpass
echo ""
read -p "Root database password......: " dbrootpass
echo ""

if [ "$repo" == "" ] || [ "$dbrootpass" == "" ] || [ "$dbuser" == "" ] || [ "$dbpass" == "" ]; then
    echo "You didn't provide an answer to one of the above prompts.  Please try again."
    exit 1
fi

read -p "Do you have a speaker pHAT installed? (Y/n) " -n1 speaker
echo ""

echo -e "\e[30;48;5;82m ##Display \e[0m"
## Display

### Auto-hide the taskbar
#TODO: this file won't exist unless the user has accessed the GUI, anyway, so we can't do this here
#sed -i 's/autohide=0/autohide=1/g' ~/.config/lxpanel/LXDE-pi/panels/panel
#sed -i 's/heightwhenhidden=2/heightwhenhidden=0/g' ~/.config/lxpanel/LXDE-pi/panels/panel

echo -e "\e[30;48;5;82m ### Rotate the LCD \e[0m"
### Rotate the LCD
printf "\nlcd_rotate=2" | sudo tee -a /boot/config.txt
echo ""
### Update permissions to allow LCD brightness adjustment
sudo chmod o+w /sys/class/backlight/rpi_backlight/brightness

echo -e "\e[30;48;5;82m ### Hide the mouse cusor \e[0m"
### Hide the mouse cursor & disable screen sleep
sudo sed -i 's/#xserver-command=X/xserver-command=X -core -nocursor -s 0 -dpms/g' /etc/lightdm/lightdm.conf

echo -e "\e[30;48;5;82m ## Node.js \e[0m"
## Node.js
sudo apt-get update
curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
sudo apt-get install -y nodejs

echo -e "\e[30;48;5;82m ## Database \e[0m"
## Database
echo -e "\e[30;48;5;82m ### Install MySQL \e[0m"
### Install MySQL
sudo apt-get install -y mysql-server
#MAY BE REQUIRED FOR DEBIAN BUSTER: sudo apt -y install mariadb-server mariadb-client

echo -e "\e[30;48;5;82m ### Case Insensitivity \e[0m"
### Case Insensitivity
printf "[mysqld]\nlower_case_table_names=1" | sudo tee -a /etc/mysql/my.cnf
sudo /etc/init.d/mysql restart

echo -e "\e[30;48;5;82m ### Create Database User and Tables \e[0m"
### Create Database User and Tables
printf "#!/bin/bash\n" > createdb.sh
printf "mysql -p$dbrootpass -u root << EOF\n" >> createdb.sh
printf "CREATE USER $dbuser@localhost IDENTIFIED BY '$dbpass';\n" >> createdb.sh
printf "CREATE DATABASE timeclock;\n" >> createdb.sh
printf "GRANT ALL PRIVILEGES ON timeclock.* TO $dbuser@localhost;\n" >> createdb.sh

printf "USE timeclock;\n" >> createdb.sh

printf "CREATE TABLE teammembers (\n" >> createdb.sh
printf "    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,\n" >> createdb.sh
printf "    lastname VARCHAR(25) NOT NULL,\n" >> createdb.sh
printf "    firstname VARCHAR(25) NOT NULL,\n" >> createdb.sh
printf "    email VARCHAR(255) DEFAULT '',\n" >> createdb.sh
printf "    role VARCHAR(10) DEFAULT 'Student',\n" >> createdb.sh
printf "    passcode VARCHAR(256) DEFAULT '',\n" >> createdb.sh
printf "    active BOOLEAN DEFAULT TRUE,\n" >> createdb.sh
printf "    deleted BOOLEAN DEFAULT FALSE,\n" >> createdb.sh
printf "    created DATETIME DEFAULT CURRENT_TIMESTAMP,\n" >> createdb.sh
printf "    created_by SMALLINT DEFAULT 0,\n" >> createdb.sh
printf "    updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n" >> createdb.sh
printf "    updated_by SMALLINT DEFAULT 0,\n" >> createdb.sh
printf "    PRIMARY KEY (id)\n" >> createdb.sh
printf ");\n" >> createdb.sh

printf "create table punches (\n" >> createdb.sh
printf "    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,\n" >> createdb.sh
printf "    memberid SMALLINT UNSIGNED NOT NULL,\n" >> createdb.sh
printf "    punchtype TINYINT(1) NOT NULL,\n" >> createdb.sh
printf "    created DATETIME DEFAULT CURRENT_TIMESTAMP,\n" >> createdb.sh
printf "    updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n" >> createdb.sh
printf "    PRIMARY KEY (id)\n" >> createdb.sh
printf ");\n" >> createdb.sh

printf "INSERT INTO teammembers (firstname, lastname, role, passcode)\n" >> createdb.sh
printf "VALUES ('Default', 'Mentor', 'Mentor', SHA2('15555',256));\n" >> createdb.sh

# Make sure that NOBODY can access the server without a password
printf "UPDATE mysql.user SET Password = PASSWORD('$dbrootpass') WHERE User = 'root';\n" >> createdb.sh
# Remove anonymous users
printf "DELETE FROM mysql.user WHERE User='';\n" >> createdb.sh
# Disallow root login remotely
printf "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');\n" >> createdb.sh
# Ensure root requires password (remove the unix_socket plugin entry if there)
printf "UPDATE mysql.user SET plugin='' WHERE user='root';\n" >> createdb.sh
# Drop the test database
printf "DROP DATABASE IF EXISTS test;\n" >> createdb.sh
# Make our changes take effect
printf "FLUSH PRIVILEGES;\n" >> createdb.sh

printf "EOF\n" >> createdb.sh

chmod +x createdb.sh
sudo ./createdb.sh
rm createdb.sh

echo -e "\e[30;48;5;82m ## App Installation \e[0m"
## App Installation
echo -e "\e[30;48;5;82m ### Application executable \e[0m"
### Application executable
curl -s https://api.github.com/repos/$repo/iptimeclock/releases/latest | grep "browser_download_url.*AppImage" | cut -d '"' -f 4 | wget -i -
read latest < <(ls -t *.AppImage | head -1)
mv $latest ~/iptimeclock
chmod +x ~/iptimeclock

echo -e "\e[30;48;5;82m ### Application configuration \e[0m"
### Application configuration
mkdir -p ~/src
git clone https://github.com/$repo/iptimeclock ~/src/iptimeclock
mkdir ~/.config/iptimeclock
cp ~/src/iptimeclock/config/* ~/.config/iptimeclock
if [ -f key.txt ]; then
    echo "#### Using the key.txt file from boot directory"
    cat key.txt > ~/.config/timeclock/key.txt
else
    read -p "Please enter the decryption key: " key
    echo $key > ~/.config/iptimeclock/key.txt
fi

echo -e "\e[30;48;5;82m ## Autostart \e[0m"
## Autostart
mkdir ~/.config/autostart
printf "[Desktop Entry]\nType=Application\nName=iptimeclock autostart\nComment=Iron Plaid Timeclock\nNoDisplay=false\nExec=/home/pi/iptimeclock" > ~/.config/autostart/iptimeclock.desktop

if [ "$speaker" == "" ] || [ "$speaker" == "y" ] || [ "$speaker" != "Y" ]; then
    echo -e "\e[30;48;5;82m ## Speaker pHAT \e[0m"
    ## Speaker pHAT
    curl -sS https://get.pimoroni.com/speakerphat | bash
fi

echo -e "\e[30;48;5;82m ## WiFi \e[0m"
## WiFi
sudo apt-get install -y network-manager
sudo systemctl disable dhcpcd
sudo systemctl stop dhcpcd

echo -e "\e[30;48;5;82m ## Additional OS configuration \e[0m"
## Additional OS configuration
printf "sudo chmod o+w /sys/class/backlight/rpi_backlight/brightness" >> ~/.bashrc
printf "alias dir='ls -alF'" >> ~/.bash_aliases
sudo raspi-config nonint do_ssh 0
sudo raspi-config nonint do_vnc 0
sudo raspi-config nonint do_hostname iptimeclock

echo ""
echo -e "\e[30;48;5;82m*** Restart when you're ready.  After restart, you'll need to connect to wifi manually:\e[0m"
echo -e "\e[30;48;5;82m*** e.g. nmcli dev wifi con \"ssid\" password \"p455w04d\"\e[0m"
