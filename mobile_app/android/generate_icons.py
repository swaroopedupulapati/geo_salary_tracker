import os
from PIL import Image, ImageDraw

src_image = r"C:\Users\venka\.gemini\antigravity\brain\08f787ce-af81-4928-9dec-d28c210c28b5\geowork_app_icon_1773217358052.png"
res_dir = r"d:\ourcode\geo_cal\mobile_app\android\app\src\main\res"

sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

def generate_icons():
    try:
        img = Image.open(src_image)
        img = img.convert("RGBA")
        
        for density, size in sizes.items():
            folder = os.path.join(res_dir, f"mipmap-{density}")
            os.makedirs(folder, exist_ok=True)
            
            # 1. Standard Square/Rounded-Square Icon (ic_launcher.png)
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(os.path.join(folder, "ic_launcher.png"), "PNG")
            
            # 2. Round Icon (ic_launcher_round.png)
            mask = Image.new("L", (size, size), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, size, size), fill=255)
            
            round_img = Image.new("RGBA", (size, size))
            round_img.paste(resized, (0, 0), mask=mask)
            round_img.save(os.path.join(folder, "ic_launcher_round.png"), "PNG")
            
            print(f"Generated {density} ({size}x{size})")
        print("All icons generated successfully.")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    generate_icons()
