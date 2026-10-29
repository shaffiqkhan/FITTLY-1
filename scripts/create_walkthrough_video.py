import os
import subprocess
import json

BASE_DIR = "/app/applet"
DOCS_DIR = os.path.join(BASE_DIR, "docs")
os.makedirs(DOCS_DIR, exist_ok=True)
TEMP_DIR = os.path.join(DOCS_DIR, "temp_scenes")
os.makedirs(TEMP_DIR, exist_ok=True)

IMG_MEASURE = os.path.join(BASE_DIR, "src/assets/images/fittly_measure_tab_1793301732035.jpg")
IMG_TAILOR = os.path.join(BASE_DIR, "src/assets/images/fittly_tailor_tab_1793301749611.jpg")
IMG_SHOP = os.path.join(BASE_DIR, "src/assets/images/fittly_shop_tab_1793301765206.jpg")
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

OUT_VIDEO = os.path.join(DOCS_DIR, "demo-walkthrough.mp4")

# Scene 1: Title Screen (5 seconds)
scene1_path = os.path.join(TEMP_DIR, "scene1.mp4")
cmd1 = [
    "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=0x09090b:s=1280x720:d=5:r=30",
    "-vf", (
        f"drawbox=x=0:y=0:w=1280:h=6:color=0x10b981@1.0:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='FITTLY':fontcolor=0x10b981:fontsize=64:x=(w-text_w)/2:y=200,"
        f"drawtext=fontfile='{FONT_BOLD}':text='AI-Powered Digital Tailoring & Sizing Studio':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=285,"
        f"drawtext=fontfile='{FONT_REG}':text='Computer Vision Keypoints • 2D Vector Tailoring • Web-Grounded Sizing':fontcolor=0xa1a1aa:fontsize=22:x=(w-text_w)/2:y=345,"
        f"drawbox=x=290:y=420:w=700:h=70:color=0x18181b@0.9:t=fill,"
        f"drawbox=x=290:y=420:w=700:h=70:color=0x10b981@0.5:t=2,"
        f"drawtext=fontfile='{FONT_BOLD}':text='30-SECOND WORKFLOW DEMONSTRATION':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=445"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", scene1_path
]
subprocess.run(cmd1, check=True)

# Scene 2: Measure Tab (8 seconds)
scene2_path = os.path.join(TEMP_DIR, "scene2.mp4")
cmd2 = [
    "ffmpeg", "-y", "-loop", "1", "-i", IMG_MEASURE, "-t", "8",
    "-vf", (
        "scale=1280:720,"
        f"drawbox=x=0:y=590:w=1280:h=130:color=0x09090b@0.92:t=fill,"
        f"drawbox=x=0:y=588:w=1280:h=3:color=0x10b981@1.0:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='STEP 1: MULTI-MODAL BIOMETRIC SCANNING':fontcolor=0x10b981:fontsize=22:x=50:y=610,"
        f"drawtext=fontfile='{FONT_REG}':text='Analyzes Front & Side poses to extract 27 anatomical landmarks and millimeter-accurate body biometrics':fontcolor=white:fontsize=18:x=50:y=645,"
        f"drawtext=fontfile='{FONT_REG}':text='Calculates chest, waist, hips, sleeve length, shoulder width, and inseam directly in browser':fontcolor=0xa1a1aa:fontsize=15:x=50:y=675"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", scene2_path
]
subprocess.run(cmd2, check=True)

# Scene 3: Tailor Tab (8 seconds)
scene3_path = os.path.join(TEMP_DIR, "scene3.mp4")
cmd3 = [
    "ffmpeg", "-y", "-loop", "1", "-i", IMG_TAILOR, "-t", "8",
    "-vf", (
        "scale=1280:720,"
        f"drawbox=x=0:y=590:w=1280:h=130:color=0x09090b@0.92:t=fill,"
        f"drawbox=x=0:y=588:w=1280:h=3:color=0x10b981@1.0:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='STEP 2: BESPOKE VECTOR TAILORING STUDIO':fontcolor=0x10b981:fontsize=22:x=50:y=610,"
        f"drawtext=fontfile='{FONT_REG}':text='Interactive SVG overlay with draggable control nodes for collar, shoulder width, sleeve & shirt hem':fontcolor=white:fontsize=18:x=50:y=645,"
        f"drawtext=fontfile='{FONT_REG}':text='Real-time Euclidean distance ratio recalculation dynamically updates tailored dimensions':fontcolor=0xa1a1aa:fontsize=15:x=50:y=675"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", scene3_path
]
subprocess.run(cmd3, check=True)

# Scene 4: Smart Shopping Assistant (6 seconds)
scene4_path = os.path.join(TEMP_DIR, "scene4.mp4")
cmd4 = [
    "ffmpeg", "-y", "-loop", "1", "-i", IMG_SHOP, "-t", "6",
    "-vf", (
        "scale=1280:720,"
        f"drawbox=x=0:y=590:w=1280:h=130:color=0x09090b@0.92:t=fill,"
        f"drawbox=x=0:y=588:w=1280:h=3:color=0x10b981@1.0:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='STEP 3: WEB-GROUNDED SIZE MATCHING':fontcolor=0x10b981:fontsize=22:x=50:y=610,"
        f"drawtext=fontfile='{FONT_REG}':text='Crawls live retail apparel URLs to extract brand sizing charts and returns optimal size options':fontcolor=white:fontsize=18:x=50:y=645,"
        f"drawtext=fontfile='{FONT_REG}':text='Weighted multi-attribute fit penalty ensures optimal fit with confidence percentage':fontcolor=0xa1a1aa:fontsize=15:x=50:y=675"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", scene4_path
]
subprocess.run(cmd4, check=True)

# Scene 5: Outro / Summary (3 seconds)
scene5_path = os.path.join(TEMP_DIR, "scene5.mp4")
cmd5 = [
    "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=0x09090b:s=1280x720:d=3:r=30",
    "-vf", (
        f"drawbox=x=0:y=0:w=1280:h=6:color=0x10b981@1.0:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='FITTLY: DIGITAL TAILORING REPRODUCIBILITY':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=240,"
        f"drawtext=fontfile='{FONT_BOLD}':text='Public GitHub: https\\://github.com/shaffiqmasud/FITTLY-1':fontcolor=0x10b981:fontsize=22:x=(w-text_w)/2:y=320,"
        f"drawtext=fontfile='{FONT_REG}':text='Interactive Live Web App Running on Google Cloud Run':fontcolor=0xa1a1aa:fontsize=20:x=(w-text_w)/2:y=370,"
        f"drawtext=fontfile='{FONT_REG}':text='SoftwareX Submission v1.2.0 • Open Source (MIT License)':fontcolor=0x71717a:fontsize=18:x=(w-text_w)/2:y=420"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", scene5_path
]
subprocess.run(cmd5, check=True)

# Create concat list
concat_list_path = os.path.join(TEMP_DIR, "concat.txt")
with open(concat_list_path, "w") as f:
    f.write(f"file '{scene1_path}'\n")
    f.write(f"file '{scene2_path}'\n")
    f.write(f"file '{scene3_path}'\n")
    f.write(f"file '{scene4_path}'\n")
    f.write(f"file '{scene5_path}'\n")

# Concatenate all into final 30-second MP4 video
cmd_concat = [
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list_path,
    "-c", "copy", OUT_VIDEO
]
subprocess.run(cmd_concat, check=True)

print("Video successfully generated at:", OUT_VIDEO)
