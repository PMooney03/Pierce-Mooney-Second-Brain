#!/bin/bash
# Test runner script for SME Infrastructure
# Generates HTML coverage reports in htmlcov folder

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install test dependencies
install_dependencies() {
    print_status "Installing test dependencies..."
    
    if command_exists pip3; then
        pip3 install -r requirements-test.txt
    elif command_exists pip; then
        pip install -r requirements-test.txt
    else
        print_error "pip not found. Please install Python and pip first."
        exit 1
    fi
}

# Function to run tests
run_tests() {
    local test_type="$1"
    local coverage_threshold="$2"
    
    print_status "Running $test_type tests..."
    
    case "$test_type" in
        "unit")
            pytest tests/test_cli.py -v --cov=cli --cov-report=html:htmlcov --cov-report=term-missing --cov-fail-under=$coverage_threshold
            ;;
        "integration")
            pytest tests/test_ansible_config.py tests/test_vagrant_config.py -v --cov=cli --cov-report=html:htmlcov --cov-report=term-missing --cov-fail-under=$coverage_threshold
            ;;
        "all")
            pytest tests/ -v --cov=cli --cov-report=html:htmlcov --cov-report=term-missing --cov-fail-under=$coverage_threshold
            ;;
        "coverage")
            pytest tests/ -v --cov=cli --cov-report=html:htmlcov --cov-report=term-missing --cov-report=xml --cov-fail-under=$coverage_threshold
            ;;
        *)
            print_error "Unknown test type: $test_type"
            exit 1
            ;;
    esac
}

# Function to show coverage report
show_coverage() {
    if [ -d "htmlcov" ]; then
        print_success "Coverage report generated in htmlcov/"
        print_status "Open htmlcov/index.html in your browser to view the report"
        
        # Try to open the report automatically
        if command_exists open; then
            open htmlcov/index.html
        elif command_exists xdg-open; then
            xdg-open htmlcov/index.html
        fi
    else
        print_warning "No coverage report found. Run tests first."
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    rm -rf .coverage
    rm -rf htmlcov
    rm -rf .pytest_cache
    rm -rf __pycache__
    find . -name "*.pyc" -delete
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
}

# Function to show help
show_help() {
    echo "SME Infrastructure Test Runner"
    echo "=============================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --test TYPE       Test type: unit, integration, all, coverage (default: all)"
    echo "  -c, --coverage THRESH Coverage threshold percentage (default: 80)"
    echo "  -i, --install         Install test dependencies"
    echo "  -s, --show            Show coverage report"
    echo "  -C, --clean           Clean up test artifacts"
    echo "  -h, --help            Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests with 80% coverage threshold"
    echo "  $0 -t unit            # Run unit tests only"
    echo "  $0 -t integration     # Run integration tests only"
    echo "  $0 -c 90              # Run tests with 90% coverage threshold"
    echo "  $0 -s                 # Show coverage report"
    echo "  $0 -C                 # Clean up test artifacts"
    echo ""
}

# Main script
main() {
    local test_type="all"
    local coverage_threshold=80
    local install_deps=false
    local show_report=false
    local cleanup_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--test)
                test_type="$2"
                shift 2
                ;;
            -c|--coverage)
                coverage_threshold="$2"
                shift 2
                ;;
            -i|--install)
                install_deps=true
                shift
                ;;
            -s|--show)
                show_report=true
                shift
                ;;
            -C|--clean)
                cleanup_only=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check if we're in the right directory
    if [ ! -f "cli.py" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Install dependencies if requested
    if [ "$install_deps" = true ]; then
        install_dependencies
    fi
    
    # Clean up if requested
    if [ "$cleanup_only" = true ]; then
        cleanup
        exit 0
    fi
    
    # Show coverage report if requested
    if [ "$show_report" = true ]; then
        show_coverage
        exit 0
    fi
    
    # Check if pytest is available
    if ! command_exists pytest; then
        print_warning "pytest not found. Installing dependencies..."
        install_dependencies
    fi
    
    # Create htmlcov directory if it doesn't exist
    mkdir -p htmlcov
    
    # Run tests
    print_status "Starting test run..."
    print_status "Test type: $test_type"
    print_status "Coverage threshold: ${coverage_threshold}%"
    echo ""
    
    if run_tests "$test_type" "$coverage_threshold"; then
        print_success "All tests passed!"
        show_coverage
    else
        print_error "Some tests failed!"
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 