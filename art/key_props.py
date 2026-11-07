# v3 の小道具。緑背景を抜いて1枚ずつ webp にする。python key_props.py（numpy と Pillow が要る）
import os
from key import key, cols, save
D = os.path.dirname(os.path.abspath(__file__))
SHEETS = {
    'propsA': ['p_invite', 'p_box', 'p_dog'],
    'propsB': ['p_bucket', 'p_mic', 'p_ring'],
    'propsC': ['p_form', 'p_hose', 'p_phone'],
    'propsD': ['p_omiai', 'p_mirrorball', 'p_cake'],
    'propsE': ['p_footseal', 'p_bib', 'p_mascot'],
    'propsF': ['p_armband', 'p_key', 'p_inkpad'],
}
for sheet, names in SHEETS.items():
    src = f'{D}/raw/{sheet}.png'
    if not os.path.exists(src): print('skip', sheet); continue
    for part, name in zip(cols(key(src)), names): save(part, name, 420, 420)
