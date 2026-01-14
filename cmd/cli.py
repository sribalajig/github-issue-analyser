#!/usr/bin/env python3
"""
Simple CLI wrapper for GitHub Scanner backend API.
Provides convenient commands for scanning repositories and analyzing issues.
"""

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


def get_api_base_url() -> str:
    """Get API base URL from environment or use default."""
    return os.getenv('API_BASE_URL', 'http://localhost:3000')


def make_request(method: str, endpoint: str, data: dict = None) -> dict:
    """
    Make HTTP request to API endpoint.
    
    Args:
        method: HTTP method (e.g., 'POST')
        endpoint: API endpoint path (e.g., '/scan')
        data: Optional JSON data to send in request body
        
    Returns:
        Parsed JSON response as dictionary
        
    Raises:
        SystemExit: On HTTP errors or connection failures
    """
    base_url = get_api_base_url()
    url = urljoin(base_url, endpoint)
    
    # Prepare request
    headers = {'Content-Type': 'application/json'}
    body = None
    
    if data:
        body = json.dumps(data).encode('utf-8')
    
    try:
        req = Request(url, data=body, headers=headers, method=method)
        
        with urlopen(req) as response:
            response_data = response.read().decode('utf-8')
            return json.loads(response_data)
            
    except HTTPError as e:
        # Try to parse error response body
        error_body = e.read().decode('utf-8') if e.fp else ''
        try:
            error_json = json.loads(error_body)
            error_msg = error_json.get('message', error_json.get('error', 'Unknown error'))
        except (json.JSONDecodeError, AttributeError):
            error_msg = error_body or f'HTTP {e.code}: {e.reason}'
        
        print(f'Error: {error_msg}', file=sys.stderr)
        sys.exit(1)
        
    except URLError as e:
        print(f'Error: Failed to connect to server at {base_url}', file=sys.stderr)
        print(f'Details: {e.reason}', file=sys.stderr)
        sys.exit(1)
        
    except json.JSONDecodeError as e:
        print(f'Error: Invalid JSON response from server', file=sys.stderr)
        print(f'Details: {e}', file=sys.stderr)
        sys.exit(1)


def format_markdown(text: str) -> str:
    """
    Simple Markdown formatting for console output.
    Adds spacing for readability while preserving structure.
    
    Args:
        text: Markdown text to format
        
    Returns:
        Formatted text with extra spacing
    """
    lines = text.split('\n')
    formatted = []
    prev_was_heading = False
    
    for line in lines:
        # Detect headings (## or ###)
        if line.startswith('##'):
            # Add extra newline before heading (except first)
            if formatted and not prev_was_heading:
                formatted.append('')
            formatted.append(line)
            prev_was_heading = True
        else:
            formatted.append(line)
            # Add spacing after headings
            if prev_was_heading and line.strip():
                formatted.append('')
                prev_was_heading = False
            elif prev_was_heading and not line.strip():
                prev_was_heading = False
    
    return '\n'.join(formatted)


def handle_scan(repo: str) -> None:
    """
    Handle scan command: fetch and cache issues for a repository.
    
    Args:
        repo: Repository in format "owner/repo-name"
    """
    print(f'Scanning repository: {repo}')
    print('-' * 50)
    
    response = make_request('POST', '/scan', {'repo': repo})
    
    # Pretty-print response
    print(f'Repository: {response.get("repo", "N/A")}')
    print(f'Issues fetched: {response.get("issues_fetched", 0)}')
    print(f'Cached successfully: {response.get("cached_successfully", False)}')
    print('✓ Scan completed successfully')


def handle_analyze(repo: str, prompt: str) -> None:
    """
    Handle analyze command: analyze cached issues using LLM.
    
    Args:
        repo: Repository in format "owner/repo-name"
        prompt: User's analysis prompt
    """
    print(f'Analyzing repository: {repo}')
    print(f'Prompt: {prompt}')
    print('-' * 50)
    print()
    
    response = make_request('POST', '/analyze', {
        'repo': repo,
        'prompt': prompt
    })
    
    # Extract and format analysis
    analysis = response.get('analysis', '')
    formatted_analysis = format_markdown(analysis)
    
    print(formatted_analysis)


def main() -> None:
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description='GitHub Scanner CLI - Scan repositories and analyze issues',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python cmd/cli.py scan facebook/react
  python cmd/cli.py analyze facebook/react "What are the main bug categories?"
  
Environment variables:
  API_BASE_URL  Base URL for the API server (default: http://localhost:3000)
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Scan command
    scan_parser = subparsers.add_parser('scan', help='Scan a repository for issues')
    scan_parser.add_argument('repo', help='Repository in format "owner/repo-name"')
    
    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze cached issues')
    analyze_parser.add_argument('repo', help='Repository in format "owner/repo-name"')
    analyze_parser.add_argument('prompt', help='Analysis prompt (use quotes for multi-word prompts)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        if args.command == 'scan':
            handle_scan(args.repo)
        elif args.command == 'analyze':
            handle_analyze(args.repo, args.prompt)
        else:
            parser.print_help()
            sys.exit(1)
            
    except KeyboardInterrupt:
        print('\n\nOperation cancelled by user', file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f'Unexpected error: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
