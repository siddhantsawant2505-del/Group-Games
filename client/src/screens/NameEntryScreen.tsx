import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight, User, Sparkles } from 'lucide-react';
import { PLAYER_COLORS, PlayerColorToken } from '@shared/theme/tokens';
import { saveUserProfile } from '../services/socket';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface NameEntryScreenProps {
  initialName?: string;
  initialColorIndex?: number;
  onContinue: (name: string, colorIndex: number) => void;
  isEditing?: boolean;
}

export function NameEntryScreen({
  initialName = '',
  initialColorIndex = 0,
  onContinue,
  isEditing = false,
}: NameEntryScreenProps) {
  const [name, setName] = useState(initialName);
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    initialColorIndex >= 0 && initialColorIndex < PLAYER_COLORS.length
      ? initialColorIndex
      : 0
  );

  const selectedColorToken: PlayerColorToken =
    PLAYER_COLORS[selectedColorIndex] || PLAYER_COLORS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Persist to localStorage
    saveUserProfile(cleanName, selectedColorIndex);

    // Transition to Home Screen
    onContinue(cleanName, selectedColorIndex);
  };

  const isNameValid = name.trim().length > 0 && name.trim().length <= 12;

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-3 pb-2"
      >
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black mb-2.5">
          <Sparkles className="w-4 h-4 text-[#18181B]" />
          <span>{isEditing ? 'Profile Settings' : 'Welcome to Party Games'}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
          {isEditing ? 'Update Your Profile' : 'Choose Your Identity'}
        </h1>
        <p className="text-xs font-bold opacity-60 mt-1">
          Pick your display name and signature player avatar color
        </p>
      </motion.div>

      {/* Main Identity Card */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl my-auto bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] space-y-6"
      >
        {/* Live Identity Avatar Preview */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative">
            <PlayerAvatar
              name={name.trim() || 'You'}
              colorHex={selectedColorToken.hex}
              size="lg"
            />
          </div>
          <span className="mt-2.5 text-base font-black text-[var(--text-primary)]">
            {name.trim() || 'Your Name'}
          </span>
          <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[var(--surface-card-subtle)] border border-[var(--border-neo)] mt-1">
            {selectedColorToken.label}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="player-name-input"
                className="block text-xs font-black uppercase tracking-wider opacity-65 text-left"
              >
                Nickname
              </label>
              <span className="text-xs font-bold opacity-60">
                {name.length}/12
              </span>
            </div>
            <div className="relative">
              <input
                id="player-name-input"
                type="text"
                maxLength={12}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full py-3.5 pl-11 pr-4 rounded-2xl border-[2.5px] border-[var(--border-neo)] bg-[var(--surface-card-subtle)] text-[var(--text-primary)] font-black text-base focus:shadow-[4px_4px_0px_var(--border-neo)] focus:-translate-y-0.5 focus:outline-none transition-all"
                required
              />
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
            </div>
          </div>

          {/* Avatar Color Palette Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-65 mb-2.5 text-left">
              Avatar Color
            </label>
            <div className="grid grid-cols-6 gap-2 sm:gap-2.5 py-1">
              {PLAYER_COLORS.map((color) => {
                const isSelected = selectedColorIndex === color.index;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColorIndex(color.index)}
                    className="group relative flex flex-col items-center justify-center cursor-pointer p-0.5 focus:outline-none"
                    aria-label={`Select ${color.label}`}
                  >
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 border-[var(--border-neo)] transition-all ${
                        isSelected
                          ? 'shadow-[3px_3px_0px_var(--border-neo)] -translate-y-1'
                          : 'shadow-[1px_1px_0px_var(--border-neo)] hover:-translate-y-0.5'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {isSelected && (
                        <Check
                          className="w-5 h-5 stroke-[3]"
                          style={{ color: '#18181B' }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Continue Action */}
          <div className="pt-2">
            <ActionButton
              type="submit"
              variant="shared"
              disabled={!isNameValid}
              icon={<ArrowRight className="w-5 h-5" />}
            >
              {isEditing ? 'Save Profile' : 'Continue to Home'}
            </ActionButton>
          </div>
        </form>
      </motion.div>

      {/* Footer hint */}
      <div className="py-4 text-center">
        <p className="text-xs opacity-60 font-bold">
          Saved locally on this device • Skip entry on future visits
        </p>
      </div>
    </div>
  );
}
