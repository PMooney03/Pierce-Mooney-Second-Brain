# SME Starter Infrastructure - Complete Project Explanation
## A Simple Guide to Understanding This Project

---

## What Is This Project?

This project is like **building a complete company IT department inside your computer**. Instead of buying expensive servers and equipment, it creates virtual computers (called "virtual machines" or VMs) that work together just like a real business network would.

Think of it like playing a simulation game, but for IT infrastructure. You can practice, learn, and test business IT systems without spending money on cloud services or real hardware.

---

## Who Would Use This?

- **Students** learning how business IT systems work
- **Small business owners** who want to understand IT infrastructure before buying it
- **IT professionals** who want to practice and experiment
- **Anyone** who wants to learn about networks, servers, and business systems

---

## What Does It Do?

This project creates a complete business IT environment with:

1. **Security systems** (firewalls to protect the network)
2. **User management** (login systems like Active Directory)
3. **File sharing** (shared folders like Google Drive or Dropbox)
4. **Websites** (internal company websites)
5. **Monitoring** (tools to watch if everything is working)
6. **Logging** (keeping records of what happens)
7. **Management** (tools to control everything)

All of these run on your computer using free, open-source software.

---

## The Components Explained Simply

### 🔐 Security Layer: Firewalls (fw-1 and fw-2)

**What they do:** Act as security guards for your network

**Simple explanation:** Just like a security guard checks who enters a building, firewalls check what data can enter and leave your network. Having two firewalls means if one fails, the other takes over automatically.

**Technical details:**
- IP Addresses: 192.168.56.3 and 192.168.56.2
- Uses software: UFW (Uncomplicated Firewall) and iptables
- Features: SSH protection, port filtering, rate limiting

---

### 👥 User Management: Domain Controllers (dc-1 and dc-2)

**What they do:** Manage users, passwords, and permissions

**Simple explanation:** Like a receptionist who knows everyone in the company and their access levels. When you log in, it checks if you're allowed to access certain files or systems.

**Technical details:**
- IP Addresses: 192.168.56.10 and 192.168.56.11
- Uses software: Samba Active Directory (free version of Windows Active Directory)
- Also provides: DNS (name resolution), Squid proxy (internet gateway)
- Features: User authentication, DNS server, network gateway

**Important:** These are **required** - the whole system won't work without at least one domain controller.

---

### 📁 File Storage: File Servers (filesrv-1 and filesrv-2)

**What they do:** Store and share files across the network

**Simple explanation:** Like a shared hard drive where everyone can save and access files. Similar to Dropbox or Google Drive, but running on your own network.

**Technical details:**
- IP Addresses: 192.168.56.20 and 192.168.56.21
- Uses software: NFS (for Linux), Samba (for Windows), GlusterFS (for redundancy)
- Shares: /public (anyone can read), /private (restricted), /backup (backups), /home (personal folders)
- Features: Multiple file sharing protocols, automatic backups

**What's being shared:**
- Public documents
- Private company files
- Backup storage
- Home directories

---

### 🌐 Web Servers (web-1 and web-2)

**What they do:** Host internal company websites

**Simple explanation:** Like having your own mini-internet inside your company. Could host things like company wikis, employee portals, or internal tools.

**Technical details:**
- IP Addresses: 192.168.56.30 and 192.168.56.31
- Uses software: Apache, Nginx, PHP
- Can run: Wikis, CRM systems, custom web applications

---

### 📊 Monitoring System (monitor-1)

**What it does:** Watches everything and tells you if something breaks

**Simple explanation:** Like security cameras showing you the health of all your systems in real-time. You can see graphs showing CPU usage, memory, network traffic, etc.

**Technical details:**
- IP Address: 192.168.56.40
- Uses software: Prometheus (collects data), Grafana (displays dashboards)
- Access: http://192.168.56.40:3000
- Default login: admin/admin
- Monitors: All servers, services, network traffic

---

### 📝 Logging System (log-1)

**What it does:** Keeps detailed records of everything that happens

**Simple explanation:** Like a security camera's recording system. It saves logs of every action, error, or event so you can investigate problems or security issues later.

**Technical details:**
- IP Address: 192.168.56.41
- Uses software: Elasticsearch (stores logs), Kibana (searches logs), Logstash (processes logs)
- Access: http://192.168.56.41:5601
- Stores: System logs, application logs, security events

---

### 🛠️ Management Servers (mgmt-1 and mgmt-2)

**What they do:** The "command center" for administrators

**Simple explanation:** Like a manager's office where you control and configure everything. Only authorized admins can access these.

**Technical details:**
- IP Addresses: 192.168.56.50 and 192.168.56.51
- Uses software: Ansible (automation), Python tools, monitoring scripts
- Features: Automated recovery, backup management, infrastructure orchestration
- Access: Restricted to administrators only

---

## How the Network Works

### The Network Layout

```
Internet
    ↓
[Firewalls: fw-1 & fw-2] ← Security guard at the door
    ↓
[Domain Controllers: dc-1 & dc-2] ← Gateway/Receptionist
    ↓
[All Other Servers] ← Everyone else in the building
```

**All computers talk to each other using:**
- **Network:** 192.168.56.0/24 (means IPs from 192.168.56.1 to 192.168.56.254)
- **Gateway:** Domain controllers (dc-1 or dc-2)
- **DNS:** Domain controllers provide name resolution

### How Traffic Flows

1. When a server needs internet → Goes through Domain Controller → Through Firewall → To Internet
2. When you need to log in → Domain Controller checks your credentials
3. When you need a file → File Server provides it (after DC verifies you)
4. When something breaks → Monitoring System alerts you

---

## Technologies Used (Simple Explanations)

### Virtualization Software

**VirtualBox:** Free software that creates virtual computers inside your real computer
- Like running multiple computers in windows on your desktop
- Each VM thinks it's a real, separate computer

**Vagrant:** A tool to automatically create and configure VirtualBox VMs
- Instead of clicking through setup wizards, you run one command
- Ensures everyone gets the same setup

### Configuration Tools

**Bash Scripts:** Automated setup instructions
- Each server type has a script (fw.sh, dc.sh, filesrv.sh, etc.)
- These install software and configure settings automatically

**Ansible:** Active automation and deployment tool
- Can update all servers at once
- Ensures consistent configuration

### Network Tools

**UFW/iptables:** Firewall software
- Controls what network traffic is allowed
- Blocks hackers and unwanted connections

**Keepalived:** High-availability tool
- Makes sure there's always a working firewall
- If fw-1 fails, fw-2 takes over automatically

### Authentication & Directory

**Samba Active Directory:** User management system
- Stores user accounts and passwords
- Controls who can access what
- Free alternative to Windows Active Directory

**Kerberos:** Secure authentication protocol
- Ensures passwords are never sent over the network
- Used by enterprise systems

**LDAP:** Directory service protocol
- Stores user and computer information
- Allows apps to look up user details

### File Sharing

**NFS (Network File System):** Unix/Linux file sharing
- Version 4 by default (modern and secure)
- Fast for Linux systems

**Samba/SMB:** Windows-compatible file sharing
- Allows Windows computers to access files
- Compatible with "Network Drives"

**GlusterFS:** Distributed storage
- Keeps files synchronized between filesrv-1 and filesrv-2
- If one server dies, files are still available

### Monitoring & Logging

**Prometheus:** Collects metrics and data
- Tracks CPU, memory, disk usage
- Stores time-series data

**Grafana:** Creates beautiful dashboards
- Displays graphs and charts
- Shows system health at a glance

**Elasticsearch:** Stores and searches logs
- Handles millions of log entries
- Fast searching

**Kibana:** Log viewing interface
- Search through logs
- Create visualizations

### Web Services

**Apache/Nginx:** Web servers
- Serve websites and web applications
- Industry-standard software

**PHP:** Programming language for web apps
- Powers many web applications
- Pre-installed with modules

---

## Configuration Options (Presets)

You don't have to run everything at once. The project has pre-made configurations:

### Minimal (Good for learning)
**Includes:** dc-1, dc-2, mgmt-1
**Uses:** ~3GB RAM
**Purpose:** Just the essentials to see how domain controllers work

### Basic (Small office)
**Includes:** dc-1, dc-2, mgmt-1, web-1, web-2
**Uses:** ~5GB RAM
**Purpose:** Add web servers to the minimal setup

### Standard (Recommended)
**Includes:** dc-1, dc-2, mgmt-1, mgmt-2, web-1, web-2, filesrv-1, monitor-1
**Uses:** ~8GB RAM
**Purpose:** A well-rounded system with file sharing and monitoring

### Production (Full experience)
**Includes:** All 12 VMs (fw-1, fw-2, dc-1, dc-2, filesrv-1, filesrv-2, web-1, web-2, monitor-1, log-1, mgmt-1, mgmt-2)
**Uses:** ~12GB RAM
**Purpose:** Complete enterprise infrastructure

### Development (For testing)
**Includes:** dc-1, mgmt-1, web-1
**Uses:** ~3GB RAM
**Purpose:** Quick testing environment

---

## How to Use It

### Starting the System

**Option 1: Start everything**
```bash
python cli.py up --default
```
This starts all 12 servers (requires 12+ GB RAM)

**Option 2: Use a preset**
```bash
python cli.py up --preset minimal
python cli.py up --preset standard
python cli.py up --preset production
```

**Option 3: Pick specific servers**
```bash
python cli.py up --host dc:2 --host web:2 --host filesrv:1
```
(Note: You MUST include at least one dc)

### Checking Status

```bash
python cli.py status
```
Shows which VMs are running, stopped, or have problems

### Stopping Everything

```bash
python cli.py halt --default
```
Gracefully shuts down all VMs (saves their state)

### Removing Everything

```bash
python cli.py destroy --default
```
Deletes all VMs (you can recreate them anytime)

---

## System Requirements

### Your Computer Needs:

**Minimum (for minimal preset):**
- 8GB RAM
- 50GB free disk space
- Dual-core processor
- Windows, Mac, or Linux

**Recommended (for standard preset):**
- 16GB RAM
- 100GB free disk space
- Quad-core processor

**Ideal (for production preset):**
- 32GB RAM
- 200GB free disk space
- 8-core processor

### Software You Need to Install:

1. **VirtualBox** (free virtualization software)
2. **Vagrant** (free VM automation tool)
3. **Python 3.7+** (free programming language)

---

## Default Passwords (IMPORTANT: Change These!)

| System | Username | Password | Purpose |
|--------|----------|----------|---------|
| Domain Admin | Administrator | Admin123! | Active Directory |
| Server Admin | sme-admin | Admin123! | Local server access |
| Grafana | admin | admin | Monitoring dashboard |
| Vagrant SSH | vagrant | vagrant | VM command line |

**⚠️ Security Warning:** These are default passwords for testing only. If you use this in any real environment, change these immediately!

---

## What Happens When You Start It

### Step-by-Step Process:

1. **Vagrant reads the Vagrantfile**
   - This file describes all 12 VMs and their settings

2. **VirtualBox creates the virtual machines**
   - Downloads Ubuntu 22.04 image (if first time)
   - Creates virtual hard drives
   - Sets up virtual network

3. **Each VM boots up and runs its bootstrap script**
   - fw.sh for firewalls
   - dc.sh for domain controllers
   - filesrv.sh for file servers
   - And so on...

4. **Bootstrap scripts install and configure software**
   - Update system packages
   - Install required software
   - Configure services
   - Set up networking
   - Create admin users

5. **VMs connect to the network**
   - Each gets its assigned IP address
   - Connects to domain controller
   - Starts providing its services

6. **Everything is ready to use**
   - Takes about 15-30 minutes depending on your computer
   - You can now access the systems

---

## Common Uses & Scenarios

### Learning IT Infrastructure
- **Students** can see how enterprise systems connect
- Practice without breaking real systems
- Experiment with configurations

### Testing Business Software
- Try out CRM systems, wikis, or custom apps
- See how they perform on a network
- Test before deploying in real office

### Disaster Recovery Practice
- Simulate server failures
- Practice recovery procedures
- Test backup systems

### Security Testing
- Learn how firewalls work
- Practice network security
- Test authentication systems

### Interview Preparation
- Hands-on experience with enterprise tools
- Build a portfolio project
- Demonstrate practical knowledge

---

## Folder Structure Explained

```
sme-starter-infra/
├── cli.py                    ← The command tool you run
├── vagrant/
│   ├── Vagrantfile           ← Describes all VMs
│   └── bootstrap/            ← Setup scripts folder
│       ├── fw.sh             ← Firewall setup
│       ├── dc.sh             ← Domain controller setup
│       ├── filesrv.sh        ← File server setup
│       ├── web.sh            ← Web server setup
│       ├── monitor.sh        ← Monitoring setup
│       ├── log.sh            ← Logging setup
│       └── mgmt.sh           ← Management setup
├── ansible/                  ← (Future) Automation scripts
├── docs/                     ← Documentation
└── README.md                 ← Main documentation
```

---

## Troubleshooting Common Issues

### Issue: VM won't start
**Solution:** 
- Check if VirtualBox is running
- Ensure you have enough RAM available
- Try `vagrant destroy` then `vagrant up` again

### Issue: Can't connect to services
**Solution:**
- Verify VM is running: `python cli.py status`
- Check IP address is correct
- Ensure domain controller (dc-1) is running first

### Issue: Script gets stuck during setup
**Solution:**
- This was the interactive prompt issue we just fixed!
- The new scripts have `DEBIAN_FRONTEND=noninteractive`
- Should no longer ask for user input

### Issue: Running out of disk space
**Solution:**
- VMs can grow large
- Delete unused VMs: `vagrant destroy <vm-name>`
- Clean up VirtualBox: `VBoxManage list hdds`

### Issue: Network not working
**Solution:**
- Ensure domain controller is running (it's the gateway)
- Check VirtualBox network settings
- Restart networking: `vagrant reload <vm-name>`

---

## Benefits of This Project

### 1. **Free and Open Source**
- No licensing costs
- No cloud bills
- All software is free

### 2. **Safe Learning Environment**
- Break things without consequences
- Easy to reset and start over
- No risk to production systems

### 3. **Realistic Experience**
- Uses real enterprise tools
- Mimics actual business setups
- Valuable resume experience

### 4. **Complete Control**
- Everything runs locally
- No internet required (after initial setup)
- Full access to all systems

### 5. **Scalable**
- Start small, add more VMs later
- Customize to your needs
- Easy to modify

---

## Key Features

### High Availability
- Redundant firewalls (fw-1 and fw-2)
- Backup domain controller (dc-2)
- Dual file servers (filesrv-1 and filesrv-2)
- If one fails, another takes over

### Centralized Management
- Single command to control everything
- Presets for common configurations
- Easy status checking

### Security
- Multiple firewall layers
- Centralized authentication
- Proxy-based internet access
- Role-based access control

### Monitoring
- Real-time dashboards
- Historical data tracking
- Alerting capabilities
- Log aggregation

### Automation
- One-command deployment
- Automated configuration
- Script-based provisioning
- (Future) Ansible automation

---

## What Makes This Project Special

### Unlike cloud services:
- ✓ No monthly costs
- ✓ Complete control
- ✓ Privacy (everything local)
- ✓ Learn infrastructure deeply

### Unlike simple VM tutorials:
- ✓ Complete ecosystem (not just one server)
- ✓ Realistic networking
- ✓ Production-like redundancy
- ✓ Professional monitoring

### Unlike enterprise setups:
- ✓ Free and accessible
- ✓ No complex licensing
- ✓ Easy to start/stop
- ✓ Safe to experiment

---

## Recent Improvements

### Fixed Interactive Prompts Issue
**Problem:** VMs would get stuck waiting for user input during package installation

**Solution:** Added `DEBIAN_FRONTEND=noninteractive` to all bootstrap scripts

**Affected scripts:**
- fw.sh (iptables-persistent prompts)
- filesrv.sh (Samba configuration prompts)
- mgmt.sh, monitor.sh, log.sh (general package prompts)

**Result:** All VMs now install automatically without asking questions

---

## Future Enhancements (Roadmap)

- Full Ansible automation for configuration
- Web-based dashboard for management
- Automated backup and recovery
- SSL certificate management
- Load balancer configuration
- Database servers (MySQL, PostgreSQL)
- Email server integration
- VPN server setup
- More detailed monitoring
- Auto-scaling capabilities

---

## Technical Details Summary

### Network Configuration
- **Network Range:** 192.168.56.0/24
- **Gateway:** Domain Controllers (192.168.56.10 or .11)
- **DNS:** Domain Controllers
- **Domain:** sme.local

### IP Address Assignments
- **Firewalls:** 192.168.56.3, 192.168.56.2
- **Domain Controllers:** 192.168.56.10-11
- **File Servers:** 192.168.56.20-21
- **Web Servers:** 192.168.56.30-31
- **Monitoring:** 192.168.56.40
- **Logging:** 192.168.56.41
- **Management:** 192.168.56.50-51

### File Sharing Details
- **NFS:** Default version negotiation (NFSv4 preferred, NFSv3 fallback)
- **Samba:** SMB protocol for Windows compatibility
- **GlusterFS:** Distributed file system for redundancy

### Software Versions
- **OS:** Ubuntu 22.04 LTS (Jammy Jellyfish)
- **Virtualization:** VirtualBox 7.1+
- **Provisioning:** Vagrant 2.4+
- **Python:** 3.7+

---

## Conclusion

This project creates a **complete, realistic business IT infrastructure** that runs entirely on your computer. It's perfect for:

- **Learning** how enterprise systems work
- **Testing** business applications
- **Practicing** IT administration
- **Demonstrating** skills to employers
- **Understanding** network architecture

The best part? It's completely free, safe to experiment with, and you can reset it anytime. Whether you're a student, professional, or business owner, this gives you hands-on experience with the same tools and techniques used in real companies.

---

## Quick Reference Card

### Essential Commands

| Action | Command |
|--------|---------|
| Start all VMs | `python cli.py up --default` |
| Start minimal setup | `python cli.py up --preset minimal` |
| Check status | `python cli.py status` |
| Stop all VMs | `python cli.py halt --default` |
| Delete all VMs | `python cli.py destroy --default` |
| See available presets | `python cli.py presets` |

### Important URLs

| Service | URL |
|---------|-----|
| Grafana Monitoring | http://192.168.56.40:3000 |
| Kibana Logs | http://192.168.56.41:5601 |
| Prometheus | http://192.168.56.40:9090 |
| Gateway Status | http://192.168.56.10/gateway-status.html |

### Default Credentials

| System | User | Password |
|--------|------|----------|
| Domain | Administrator | Admin123! |
| Servers | sme-admin | Admin123! |
| Grafana | admin | admin |
| SSH | vagrant | vagrant |

---

**Document Created:** October 23, 2024  
**Project:** SME Starter Infrastructure  
**Purpose:** Educational and testing infrastructure  
**License:** MIT (Free to use and modify)

---

## Support & Resources

- **Project Files:** Located in your working directory
- **Documentation:** See `docs/` folder
- **Configuration:** Edit `vagrant/Vagrantfile`
- **Scripts:** Located in `vagrant/bootstrap/`

Remember: This is a learning and testing environment. Always use strong, unique passwords in production environments!






