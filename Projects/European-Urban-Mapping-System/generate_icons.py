"""
Generate PWA icons for European Mapping System
Creates icons in various sizes required for PWA
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """Create a simple icon with a map marker symbol"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle
    margin = size // 10
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=(52, 73, 94, 255)  # #2c3e50
    )
    
    # Map marker shape (simplified)
    marker_size = size // 3
    marker_x = size // 2
    marker_y = size // 2 - marker_size // 4
    
    # Marker body (rounded rectangle)
    marker_body = [
        marker_x - marker_size // 2,
        marker_y - marker_size // 2,
        marker_x + marker_size // 2,
        marker_y + marker_size // 2
    ]
    draw.rounded_rectangle(marker_body, radius=marker_size // 6, fill=(52, 152, 219, 255))  # #3498db
    
    # Marker point (triangle)
    point_size = marker_size // 3
    triangle_points = [
        (marker_x, marker_y + marker_size // 2),
        (marker_x - point_size, marker_y + marker_size // 2 + point_size),
        (marker_x + point_size, marker_y + marker_size // 2 + point_size)
    ]
    draw.polygon(triangle_points, fill=(52, 152, 219, 255))
    
    # Save icon
    img.save(output_path, 'PNG')
    print(f"Created icon: {output_path} ({size}x{size})")

def main():
    """Generate all required icon sizes"""
    icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    icons_dir = 'static/icons'
    
    # Create directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)
    
    # Generate icons
    for size in icon_sizes:
        output_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
        create_icon(size, output_path)
    
    print(f"\nAll icons generated in {icons_dir}/")

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print("Pillow (PIL) is required. Install with: pip install Pillow")
        print("Creating placeholder icons instead...")
        # Create placeholder files
        icons_dir = 'static/icons'
        os.makedirs(icons_dir, exist_ok=True)
        icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        for size in icon_sizes:
            # Create a simple text file as placeholder
            with open(os.path.join(icons_dir, f'icon-{size}x{size}.png'), 'w') as f:
                f.write(f"Placeholder icon {size}x{size}")
        print("Placeholder icons created. Install Pillow and run again for proper icons.")


