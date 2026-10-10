import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Hand,
  ListOrdered,
  Lock,
  MoveVertical,
  Eye,
} from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface Top100RankScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  /** Host only: push a new ordering (also used while dragging, throttled). */
  onReorder: (order: string[]) => void;
  /** Host only: lock the order in and jump to the results reveal. */
  onLockOrder: () => void;
}

/** How often a live drag pushes its order to the server (milliseconds). */
const LIVE_EMIT_INTERVAL_MS = 160;

/**
 * Top 100 — Rank Phase (host-authoritative v1).
 * The host drags the examples into what they believe is ascending numeric
 * order; everyone else watches that order update live on their own screen.
 */
export function Top100RankScreen({
  room,
  myPlayer,
  onReorder,
  onLockOrder,
}: Top100RankScreenProps) {
  const top100 = room.top100State;
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const cards = top100?.examples || [];
  const byId = new Map(cards.map((card) => [card.playerId, card]));
  const serverOrder = cards.map((card) => card.playerId);
  const serverOrderKey = serverOrder.join(',');

  const canDrag = isHost && Boolean(top100) && !top100?.orderLocked;

  const [order, setOrder] = useState<string[]>(serverOrder);
  const orderRef = useRef<string[]>(serverOrder);
  const draggingRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const lastEmitRef = useRef(0);

  // Follow the server's order whenever we are not the one dragging.
  useEffect(() => {
    if (draggingRef.current) return;
    if (serverOrderKey === orderRef.current.join(',')) return;
    orderRef.current = serverOrder;
    setOrder(serverOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOrderKey]);

  const emit = useCallback(
    (next: string[], force = false) => {
      const now = Date.now();
      if (!force && now - lastEmitRef.current < LIVE_EMIT_INTERVAL_MS) return;
      lastEmitRef.current = now;
      onReorder(next);
    },
    [onReorder]
  );

  const applyOrder = useCallback(
    (next: string[], forceEmit = false) => {
      orderRef.current = next;
      setOrder(next);
      emit(next, forceEmit);
    },
    [emit]
  );

  /** Moves a card to a target index (used by the arrow controls). */
  const moveCard = useCallback(
    (id: string, targetIndex: number) => {
      const ids = orderRef.current;
      const from = ids.indexOf(id);
      if (from === -1 || targetIndex < 0 || targetIndex >= ids.length || targetIndex === from) {
        return;
      }
      const next = [...ids];
      next.splice(from, 1);
      next.splice(targetIndex, 0, id);
      applyOrder(next, true);
    },
    [applyOrder]
  );

  // Pointer-driven dragging: the pointer's Y position decides which slot the
  // card currently occupies, and the list reorders live underneath it.
  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (event: PointerEvent) => {
      const y = event.clientY;
      const ids = orderRef.current;
      const from = ids.indexOf(draggingId);
      if (from === -1) return;

      let target = from;
      for (let i = 0; i < ids.length; i++) {
        const el = itemRefs.current[ids[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          target = i;
          break;
        }
        if (y < rect.top) {
          target = i;
          break;
        }
        target = i;
      }

      if (target === from) return;

      const next = [...ids];
      next.splice(from, 1);
      next.splice(target, 0, draggingId);
      orderRef.current = next;
      setOrder(next);
      emit(next);
    };

    const finish = () => {
      const id = draggingRef.current;
      draggingRef.current = null;
      setDraggingId(null);
      if (id) {
        // Final push guarantees the server has the exact order the host sees.
        onReorder(orderRef.current);
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [draggingId, emit, onReorder]);

  const handlePointerDown = (event: React.PointerEvent, id: string) => {
    if (!canDrag) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = id;
    setDraggingId(id);
    lastEmitRef.current = 0;
  };

  const visibleOrder = order.filter((id) => byId.has(id));

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-28">
        {/* Header */}
        <div className="text-center mb-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-1"
            style={{ backgroundColor: `${playerColor.hex}18`, color: 'var(--text-primary)' }}
          >
            <ListOrdered className="w-3.5 h-3.5" style={{ color: playerColor.hex }} />
            <span>Rank Phase</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">Put Them in Order</h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {canDrag
              ? 'Drag each card so the mildest example is at the top and the most extreme at the bottom.'
              : 'The host is arranging the cards — watch the order update live.'}
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label={canDrag ? 'Your time to rank' : 'Host is ranking'}
          />
        )}

        {/* Orientation strip */}
        {top100 && (
          <div className="party-card p-3 rounded-2xl mt-3 flex items-center justify-between gap-3">
            <div className="text-left min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                Top = 1
              </span>
              <span className="text-sm font-black text-[var(--text-primary)] truncate block">
                {top100.lowLabel}
              </span>
            </div>
            <MoveVertical className="w-4 h-4 text-neutral-400 shrink-0" />
            <div className="text-right min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                Bottom = 100
              </span>
              <span className="text-sm font-black text-[var(--text-primary)] truncate block">
                {top100.highLabel}
              </span>
            </div>
          </div>
        )}

        {canDrag && (
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-neutral-400">
            <Hand className="w-3.5 h-3.5" />
            <span>Drag the grip, or nudge a card with the arrows</span>
          </div>
        )}

        {!isHost && (
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live view</span>
          </div>
        )}

        {/* Drag list */}
        <ul className="space-y-2.5 mt-4" data-testid="top100-rank-list">
          {visibleOrder.map((id, index) => {
            const card = byId.get(id);
            if (!card) return null;
            const isDragging = draggingId === id;
            return (
              <li
                key={id}
                ref={(el) => {
                  itemRefs.current[id] = el;
                }}
                data-order-index={index}
                data-player-id={id}
                className={`party-card rounded-2xl p-3 flex items-center gap-2.5 transition-shadow ${
                  isDragging ? 'shadow-xl ring-2 ring-neutral-900/20 dark:ring-white/25' : 'shadow-xs'
                }`}
                style={{
                  borderLeft: `6px solid ${card.playerColor}`,
                  transform: isDragging ? 'scale(1.015)' : undefined,
                }}
              >
                <span
                  className="w-6 h-6 shrink-0 rounded-full text-[11px] font-black flex items-center justify-center"
                  style={{ backgroundColor: `${card.playerColor}22`, color: 'var(--text-primary)' }}
                >
                  {index + 1}
                </span>

                {canDrag && (
                  <button
                    type="button"
                    aria-label={`Drag ${card.playerName}'s example`}
                    data-testid={`top100-grip-${id}`}
                    onPointerDown={(event) => handlePointerDown(event, id)}
                    className="shrink-0 p-1 -m-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing touch-none"
                    style={{ touchAction: 'none' }}
                  >
                    <GripVertical className="w-5 h-5" />
                  </button>
                )}

                <PlayerAvatar
                  name={card.playerName}
                  colorIndex={card.colorIndex}
                  colorHex={card.playerColor}
                  size="xs"
                />

                <div className="min-w-0 flex-1 text-left">
                  <span className="text-[11px] font-black block leading-tight truncate text-neutral-400">
                    {card.playerName}
                    {id === myPlayer.id && ' (You)'}
                  </span>
                  <p className="text-sm font-bold leading-snug text-[var(--text-primary)]">
                    {card.text}
                  </p>
                </div>

                {canDrag && (
                  <div className="shrink-0 flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${card.playerName}'s example up`}
                      data-testid={`top100-up-${id}`}
                      disabled={index === 0}
                      onClick={() => moveCard(id, index - 1)}
                      className="p-0.5 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${card.playerName}'s example down`}
                      data-testid={`top100-down-${id}`}
                      disabled={index === visibleOrder.length - 1}
                      onClick={() => moveCard(id, index + 1)}
                      className="p-0.5 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}

          {visibleOrder.length === 0 && (
            <p className="text-xs font-semibold text-neutral-400 text-center py-6">
              Waiting for the example board...
            </p>
          )}
        </ul>
      </div>

      {/* Bottom control */}
      <div className="pt-5 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onLockOrder}
            disabled={!canDrag}
            icon={<Lock className="w-5 h-5" />}
            subtext="Reveal the true numbers and score the group"
          >
            Lock In Order
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center flex items-center justify-center gap-2">
            <Eye className="w-3.5 h-3.5 text-neutral-400" />
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Results appear as soon as the host locks the order in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
