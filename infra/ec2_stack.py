from aws_cdk import (
    Stack,
    CfnOutput,
    aws_ec2 as ec2,
    aws_route53 as route53,
    Duration,
)
from constructs import Construct


class Ec2ProjectStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, domain_name: str = None, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Use default VPC
        vpc = ec2.Vpc.from_lookup(self, "DefaultVpc", is_default=True)

        # Create security group
        security_group = ec2.SecurityGroup(
            self, "WebServerSG",
            vpc=vpc,
            description="Security group for web server",
            allow_all_outbound=True
        )

        # Allow SSH
        security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(22),
            "Allow SSH"
        )

        # Allow HTTP
        security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(80),
            "Allow HTTP"
        )

        # Allow HTTPS
        security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(443),
            "Allow HTTPS"
        )

        # Allow FastAPI (port 8000)
        security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(8000),
            "Allow FastAPI"
        )

        # Allow Angular dev server (port 4200)
        security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(4200),
            "Allow Angular"
        )

        # Simplified user data - just basic setup
        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "#!/bin/bash",
            "sudo dnf update -y",
            "sudo dnf install -y git",
            "echo 'Instance is ready!' | sudo tee /var/log/user-data.log",

            "sudo dnf install -y docker",
            "sudo systemctl start docker",
            "sudo systemctl enable docker",
            "sudo usermod -a -G docker ec2-user",

            "sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose",
            "sudo chmod +x /usr/local/bin/docker-compose",
            
            # Install Python 3 and pip
            "sudo dnf install -y python3 python3-pip",
            "sudo dnf install -y nginx certbot python3-certbot-nginx",
            "sudo systemctl enable nginx",
        )

        # Create EC2 instance
        instance = ec2.Instance(
            self, "WebServer",
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.T3, 
                ec2.InstanceSize.SMALL
            ),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            vpc=vpc,
            security_group=security_group,
            key_name="Elsuq-ssh-key",
            user_data=user_data
        )

        # Domain configuration (if domain provided)
        if domain_name:
            # Lookup the existing hosted zone
            hosted_zone = route53.HostedZone.from_lookup(
                self, "HostedZone",
                domain_name=domain_name
            )

            # Create A record pointing to the instance public IP
            route53.ARecord(
                self, "ARecord",
                zone=hosted_zone,
                target=route53.RecordTarget.from_ip_addresses(instance.instance_public_ip),
                ttl=Duration.minutes(5)
            )

            # Create www subdomain record
            route53.ARecord(
                self, "WWWRecord",
                zone=hosted_zone,
                record_name="www",
                target=route53.RecordTarget.from_ip_addresses(instance.instance_public_ip),
                ttl=Duration.minutes(5)
            )

        # Output the public IP
        CfnOutput(
            self, "PublicIP",
            value=instance.instance_public_ip,
            description="Public IP of the EC2 instance"
        )

        # Output SSH command
        CfnOutput(
            self, "SSHCommand",
            value=f"ssh -i Elsuq-ssh-key.pem ec2-user@{instance.instance_public_ip}",
            description="SSH command to connect to the instance"
        )

        # Output server status URL
        CfnOutput(
            self, "ServerStatusURL",
            value=f"https://{domain_name}" if domain_name else f"http://{instance.instance_public_ip}",
            description="Application URL"
        )