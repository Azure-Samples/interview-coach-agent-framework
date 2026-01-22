## Install additional apt packages
sudo apt-get update && \
    sudo apt upgrade -y && \
    sudo apt-get install -y dos2unix libsecret-1-0 xdg-utils fonts-naver-d2coding && \
    sudo apt-get clean -y && \
    sudo rm -rf /var/lib/apt/lists/*

## Configure git
echo Configure git
git config --global pull.rebase false
git config --global core.autocrlf input

## Install .NET dev certs
echo Install .NET dev certs
dotnet dev-certs https --trust

## Add .NET Aspire workload
echo Install Aspire template
curl -sSL https://aspire.dev/install.sh | bash
dotnet new install Aspire.ProjectTemplates --force

## Add .NET AI templates
echo Install .NET AI templates
dotnet new install Microsoft.Extensions.AI.Templates --force
dotnet new install Microsoft.Agents.AI.ProjectTemplates --force

# D2Coding Nerd Font
echo Install D2Coding Nerd Font
mkdir $HOME/.local
mkdir $HOME/.local/share
mkdir $HOME/.local/share/fonts
wget https://github.com/ryanoasis/nerd-fonts/releases/latest/download/D2Coding.zip
unzip D2Coding.zip -d $HOME/.local/share/fonts
rm D2Coding.zip

## AZURE BICEP CLI ##
echo Install Azure Bicep CLI
az bicep install

## OH-MY-POSH ##
echo Install oh-my-posh
sudo wget https://github.com/JanDeDobbeleer/oh-my-posh/releases/latest/download/posh-linux-amd64 -O /usr/local/bin/oh-my-posh
sudo chmod +x /usr/local/bin/oh-my-posh

echo DONE!
