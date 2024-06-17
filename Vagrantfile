require 'yaml'

# https://stackoverflow.com/a/38702906/4156752
class Hash
    def deep_merge(other)
        self.merge(other) { |key, value1, value2| value1.is_a?(Hash) && value2.is_a?(Hash) ? value1.deep_merge(value2) : value2}
    end
    def deep_merge!(other)
        self.merge!(other) { |key, value1, value2| value1.is_a?(Hash) && value2.is_a?(Hash) ? value1.deep_merge(value2) : value2}
    end
end

# Requires Ruby >=2.3.0 (25.12.2015) because of the dig method (https://docs.ruby-lang.org/en/2.3.0/Array.html#method-i-dig)
Vagrant.require_version '>= 2.1.0' # (03.05.2018) because of Triggers (https://developer.hashicorp.com/vagrant/docs/triggers)

Vagrant.configure('2') do |config|
    # --------------------------------------------------------------------------
    # Load configuration
    # --------------------------------------------------------------------------
    settingsFallback = settingsDist = settingsCustom = {}
    if File.exist?('.vagrant.config.yml.dist')
        settingsDist = YAML.load(File.read('.vagrant.config.yml.dist'))
    end
    # TODO: Handle empty file "in `merge': no implicit conversion of nil into Hash (TypeError)"
    if File.exist?('.vagrant.config.yml')
        settingsCustom = YAML.load(File.read('.vagrant.config.yml'))
    end
    settings = settingsFallback.deep_merge(settingsDist).deep_merge(settingsCustom)

    # --------------------------------------------------------------------------
    # Configure the machine
    # --------------------------------------------------------------------------
    config.vm.box = 'bento/debian-12'

    config.vm.provider 'virtualbox' do |v|
        # Set the name to show in the GUI
        if settings.dig('vm', 'name')
            v.name = settings.dig('vm', 'name')
        elsif settings.dig('network', 'hostname')
            v.name = settings.dig('network', 'hostname')
        end

        # Set the CPU limit
        if settings.dig('vm', 'cpus')
            v.cpus = settings.dig('vm', 'cpus')
        end
        # Set the amount of memory to allocate to the VM
        if settings.dig('vm', 'memory')
            v.memory = settings.dig('vm', 'memory')
        end
    end

    # --------------------------------------------------------------------------
    # Configure the network
    # --------------------------------------------------------------------------
    # Set the main hostname
    if settings.dig('network', 'hostname')
        config.vm.hostname = settings.dig('network', 'hostname')
    end
    # Add alternative hostnames
    if Vagrant.has_plugin?('vagrant-hostsupdater')
        if settings.dig('network', 'aliases')
            config.hostsupdater.aliases = settings.dig('network', 'aliases')
        end
    end

    # Define main IP address
    if settings.dig('network', 'ip')
        config.vm.network 'private_network', ip: settings.dig('network', 'ip')

        if Vagrant.has_plugin?('vagrant-notify-forwarder')
            # This configures the notify-forwarder to a port derived from the IP
            # address to ensure that all running boxes have a different port
            config.notify_forwarder.port = 22000 + settings.dig('network', 'ip').split('.')[2].to_i() + settings.dig('network', 'ip').split('.')[3].to_i()
        end
    else
        config.vm.network 'private_network', type: 'dhcp'
    end

    # --------------------------------------------------------------------------
    # Configure the synced folders
    # --------------------------------------------------------------------------
    # TODO: Function to check if Yarn is installed on the host machine
    #def yarn_installed?
    #  system("yarn --version > /dev/null 2>&1")
    #end
    # Get the path of the Yarn cache if Yarn is installed
    #yarn_cache_path = yarn_installed? ? `yarn cache dir`.strip : nil

    if settings.dig('folder', 'type') == 'nfs'
        config.nfs.map_uid = Process.uid
        config.nfs.map_gid = Process.gid

        # Mount the Project itself
        config.vm.synced_folder '.', '/vagrant',
            type: 'nfs',
            nfs_version: 3, # TODO: Update to NFSv4
            nfs_udp: false, # UDP not allowed in NFSv4
            mount_options: ['rw', 'tcp', 'nolock', 'async']

        # TODO: Set up synced folder using NFS if Yarn cache path is available
        #if yarn_cache_path
        #    config.vm.synced_folder yarn_cache_path, "/home/vagrant/data/yarn",
        #        type: 'nfs'
        #end
    elsif settings.dig('folder', 'type') == 'rsync'
        config.vm.synced_folder '.', '/vagrant',
            type: 'rsync',
            rsync__args: ['--verbose', '--archive', '--delete', '-z'],
            rsync__chown: true,
            rsync__exclude: settings.dig('folder', 'rsync', 'exclude') || []

        # An rsync watcher for Vagrant 1.5.1+ that uses fewer host resources at
        # the potential cost of more rsync actions.
        # Configure the window for gatling to coalesce writes.
        if Vagrant.has_plugin?('vagrant-gatling-rsync')
            config.gatling.latency = 1.5
            config.gatling.time_format = '%H:%M:%S'

            # Automatically sync when machines with rsync folders come up.
            config.gatling.rsync_on_startup = false
        end
    elsif settings.dig('folder', 'type') == 'smb'
        # https://github.com/hashicorp/vagrant/issues/6677#issuecomment-165873490
        if settings.dig('folder', 'smb', 'username') && settings.dig('folder', 'smb', 'password')
          config.vm.synced_folder '.', '/vagrant',
              type: 'smb',
              mount_options: ['vers=3.02', 'mfsymlinks'],
              smb_username: settings.dig('folder', 'smb', 'username'),
              smb_password: settings.dig('folder', 'smb', 'password')
        else
          config.vm.synced_folder '.', '/vagrant',
              type: 'smb',
              mount_options: ['vers=3.02', 'mfsymlinks']
        end
    else
        # VirtualBox shared folders
        config.vm.synced_folder '.', '/vagrant'
    end

    # --------------------------------------------------------------------------
    # Provision the machine
    # --------------------------------------------------------------------------
    if Vagrant.has_plugin?('vagrant-vbguest')
        # Temporary until base box is updated (see https://github.com/dotless-de/vagrant-vbguest/issues/351)
        config.vbguest.auto_update = false
    end

    # Add custom PS1
    config.vm.provision 'custom-ps1', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        echo 'export PS1='\\''📦 ${debian_chroot:+($debian_chroot)}\\[\\e[38;5;46m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[38;5;33m\\]\\w\\[\\e[0m\\]\\\\$ '\\' >> ~/.bashrc
    SCRIPT

    config.vm.provision 'enable-ssh-password-auth', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
        sudo sed -i 's/PasswordAuthentication no//' /etc/ssh/sshd_config
        sudo /etc/init.d/ssh restart
    SCRIPT

    # Copy the public SSH key of the host system user to the vagrant box to
    # allow Git access
    if File.file?(File.expand_path('~/.ssh/id_ed25519')) && File.file?(File.expand_path('~/.ssh/id_ed25519.pub'))
        config.vm.provision 'file', source: '~/.ssh/id_ed25519', destination: '~/.ssh/id_ed25519', run: 'always'
        config.vm.provision 'file', source: '~/.ssh/id_ed25519.pub', destination: '~/.ssh/id_ed25519.pub', run: 'always'
    elsif File.file?(File.expand_path('~/.ssh/id_rsa')) && File.file?(File.expand_path('~/.ssh/id_rsa.pub'))
        puts 'Still using RSA? Consider switching to ED25519 for better security'
        config.vm.provision 'file', source: '~/.ssh/id_rsa', destination: '~/.ssh/id_rsa', run: 'always'
        config.vm.provision 'file', source: '~/.ssh/id_rsa.pub', destination: '~/.ssh/id_rsa.pub', run: 'always'
    else
        puts 'No SSH key found, please generate them first'
        puts 'ECDSA: $ ssh-keygen -t ed25519 -C "your_email@example.com"'
        puts 'RSA:   $ ssh-keygen -t rsa -b 4096 -C "your_email@example.com"'
        exit
    end
    config.vm.provision 'fix-ssh-permissions', type: 'shell', privileged: false, reset: true, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        if [ -f ~/.ssh/id_ed25519 ]; then
            chmod 600 ~/.ssh/id_ed25519
        fi
    SCRIPT
    config.vm.provision 'update-known_hosts', type: 'shell', privileged: false, reset: true, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
    SCRIPT

    # Start SSH agent and add SSH key to agent
    config.vm.provision 'start-ssh-agent-at-boot', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        echo 'eval "$(ssh-agent -s)"' >> ~/.bashrc
        echo 'ssh-add -l > /dev/null || ssh-add' >> ~/.bashrc
    SCRIPT

    config.vm.provision 'chdir-to-dockerfile', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        echo 'cd /vagrant' >> ~/.bashrc
    SCRIPT

    config.vm.provision 'create-app-data-folders', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        mkdir --parents \
            ~/data/pnpm
    SCRIPT

    config.vm.provision 'fix-app-data-permissions', type: 'shell', privileged: false, run: 'always', inline: <<-SCRIPT
        set -e -u -x -o pipefail
        sudo chown --recursive vagrant:vagrant ~/data
    SCRIPT

    # Copy compose.yml.dist if it doesn't exist yet to compose.yml
    config.vm.provision 'copy-necessary-dist-files', type: 'shell', privileged: false, run: 'always', inline: <<-SCRIPT
        set -e -u -x -o pipefail
        if [ ! -f /vagrant/compose.yml ]; then
            cp /vagrant/compose.vm.yml.dist /vagrant/compose.yml
        fi
    SCRIPT

    # Run mkcert on host if cert files don't exist yet or incomplete
    if not File.exist?('./.docker/certs/cert.pem') || File.exist?('./.docker/certs/key.pem')
        # TODO: Check that mkcert is installed, otherwise i think this failing will be ignored
        system('mkcert -cert-file ./.docker/certs/cert.pem -key-file ./.docker/certs/key.pem localhost weleda-webcenter-text-export.test "*.weleda-webcenter-text-export.test"')
    end

    config.vm.provision 'check-certificates', type: 'shell', privileged: false, run: 'always', inline: <<-SCRIPT
        set -e -u -x -o pipefail
        if [ ! -f /vagrant/.docker/certs/cert.pem ] || [ ! -f /vagrant/.docker/certs/cert.pem ]; then
            echo "Certificate files are missing. Please run 'mkcert -cert-file ./.docker/certs/cert.pem -key-file ./.docker/certs/key.pem localhost weleda-webcenter-text-export.test "*.weleda-webcenter-text-export.test"' on the host machine."
        fi
    SCRIPT

    # Increase file watcher limit for Vite.js
    #config.vm.provision 'fix-file-watcher-limit', type: 'shell', privileged: false, inline: <<-SCRIPT
    #    set -e -u -x -o pipefail
    #    echo fs.inotify.max_user_watches=100000 | sudo tee -a /etc/sysctl.conf >/dev/null
    #    sudo sysctl -p >/dev/null
    #SCRIPT

    # Update Box and fix "dpkg-reconfigure: unable to re-open stdin: No file or directory"
    # See https://serverfault.com/a/717770/955565
    config.vm.provision 'prepare-and-fix-apt', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        sudo ex +"%s@DPkg@//DPkg" -cwq /etc/apt/apt.conf.d/70debconf
        sudo dpkg-reconfigure debconf -f noninteractive -p critical

        sudo apt-get update -qq

        # TODO: dist-upgrade locks the machine during bios update
        #sudo apt-get dist-upgrade -qq >/dev/null
    SCRIPT

    # Fixes "fatal: detected dubious ownership in repository at '/vagrant'"
    config.vm.provision 'fix-git-error-ownership', type: 'shell', privileged: false, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        sudo apt-get -qq install \
            git >/dev/null
        git config --global --add safe.directory /vagrant
    SCRIPT

    config.vm.provision 'install-docker-and-compose', type: 'shell', privileged: false, reset: true, inline: <<-SCRIPT
        set -e -u -x -o pipefail
        # Setup repository
        sudo apt-get update -qq
        sudo apt-get -qq install \
            ca-certificates \
            curl \
            gnupg >/dev/null
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
            "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
            "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
            sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Install Docker
        sudo apt-get update -qq
        sudo apt-get -qq install \
            docker-ce \
            docker-ce-cli \
            containerd.io \
            docker-buildx-plugin \
            docker-compose-plugin >/dev/null

        # Manage Docker as a non-root user
        getent group docker >/dev/null || sudo groupadd docker
        sudo usermod -aG docker vagrant
    SCRIPT

    class DockerUsername
        def to_s
            print "Please enter your Docker credentials (the same as for dockerhub.com)\n"
            print 'Username: '
            STDIN.gets.chomp
        end
    end
    class DockerPassword
        def to_s
            begin
                system 'stty -echo'
                print 'Password (or Access Token if you have 2FA): '
                map = {'"' => '%22', '#' => '%23', '^' => '25%5E' }
                re = Regexp.new(map.keys.map { |x| Regexp.escape(x) }.join('|'))
                pass = STDIN.gets.chomp.gsub(re, map)
            ensure
                system 'stty echo'
            end
            pass
        end
    end
    # TODO: Still insecure
    config.vm.provision 'docker-login', type: 'shell', privileged: false, env: { 'USERNAME' => DockerUsername.new, 'PASSWORD' => DockerPassword.new }, inline: <<-SHELL
        set -e -u -o pipefail
        echo $PASSWORD | docker login --username $USERNAME --password-stdin
    SHELL

    config.trigger.after :up do |trigger|
        trigger.name = 'Start Containers'
        trigger.info = 'Starting Docker containers...'
        trigger.run_remote = { privileged: false, inline: <<-SCRIPT
            set -e -u -x -o pipefail
            cd /vagrant
            eval "$(ssh-agent -s)"
            ssh-add -l > /dev/null || ssh-add
            docker compose pull
            docker compose build --pull
            docker compose --profile dev up --detach
        SCRIPT
        }
    end
    config.vm.post_up_message = 'Machine was booted. Docker is starting. To check use "docker compose logs -f pwa api".'
    if settings.dig('network', 'hostname') || settings.dig('network', 'ip')
        config.vm.post_up_message += ' The application will soon be available on https://' + (settings.dig('network', 'hostname') || settings.dig('network', 'ip'))
    end

    config.trigger.before :halt do |trigger|
        trigger.name = 'Stop Containers'
        trigger.info = 'Stopping Docker containers...'
        trigger.run_remote = { privileged: false, inline: <<-SCRIPT
            set -e -u -x -o pipefail
            cd /vagrant
            docker compose down
        SCRIPT
        }
    end
end
