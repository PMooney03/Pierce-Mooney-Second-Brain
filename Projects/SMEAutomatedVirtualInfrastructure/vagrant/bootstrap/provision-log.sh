# Tee all bootstrap output to a single file for troubleshooting (ai-log --host-debug).
PROVISION_LOG=/var/log/vagrant-provision.log
exec > >(tee -a "${PROVISION_LOG}") 2>&1
