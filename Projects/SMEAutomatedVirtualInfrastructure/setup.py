"""
Setup configuration for SME Starter Infrastructure CLI
"""
from setuptools import setup, find_packages
from pathlib import Path

# Read the README file for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

# Read requirements
requirements_file = Path(__file__).parent / "requirements.txt"
requirements = ["flask>=2.3.0"]
if requirements_file.exists():
    requirements = [
        line.strip()
        for line in requirements_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="sme-starter-infra",
    version="1.0.0",
    description="Finished SME infrastructure automation project with Vagrant, Ansible, and an optional Flask GUI",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="SME Infrastructure Team",
    author_email="",
    license="MIT",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Intended Audience :: Education",
        "Topic :: System :: Systems Administration",
        "Topic :: System :: Networking",
        "Topic :: Education",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
    packages=find_packages(exclude=["tests", "tests.*", "*.tests", "*.tests.*"]),
    py_modules=["cli"],
    install_requires=requirements,
    package_data={
        "ai_assistant": [
            "README.md",
            "evaluation_questions.md",
            "prompts/*.txt",
            "examples/*.json",
            "examples/*.log",
        ]
    },
    extras_require={
        "dev": [
            "pytest>=7.4.3",
            "pytest-cov>=4.1.0",
            "pytest-mock>=3.12.0",
            "pytest-html>=4.1.1",
            "coverage>=7.3.2",
            "pytest-xdist>=3.3.1",
            "pytest-timeout>=2.1.0",
            "pytest-asyncio>=0.21.1",
            "PyYAML>=6.0.1",
        ],
        "test": [
            "pytest>=7.4.3",
            "pytest-cov>=4.1.0",
            "pytest-mock>=3.12.0",
            "pytest-html>=4.1.1",
            "coverage>=7.3.2",
            "pytest-xdist>=3.3.1",
            "pytest-timeout>=2.1.0",
            "pytest-asyncio>=0.21.1",
            "PyYAML>=6.0.1",
        ],
    },
    entry_points={
        "console_scripts": [
            "sme-spinup=cli:main",
            "sme-infra=cli:main",
            "sme-ssh=cli:ssh_main",
            "sme-ai-log=ai_assistant.analyse_setup_log:main",
            "sme-ai-alert=ai_assistant.analyse_alert:main",
            "sme-ask=ai_assistant.ask:ask_interactive",
        ],
    },
    include_package_data=True,
    zip_safe=False,
    keywords="vagrant, infrastructure, vm, virtualization, ansible, devops, sme",
)
