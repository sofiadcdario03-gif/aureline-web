import React, { useState } from 'react';
import { Check, CreditCard, Printer } from 'lucide-react';
import { nights, money, dateLabel } from '../../data.js';
import { fullName } from '../../utils/formatters.js';
import api from '../../services/api.js';
import Badge from '../ui/Badge.jsx';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function PaymentForm({ item, onClose, ...c }) {
  const b = c.bookings.find((b) => b.id === item.id) || item;
  const balance = Math.max(0, c.total(b) - c.paid(b));
  const [amount, setAmount] = useState(balance),
    [method, setMethod] = useState('Cash');
  const history = c.payments.filter((p) => p.bookingId === b.id);
  return (
    <Modal title="Aureline Hotel" subtitle={`Statement of account · ${b.id}`} onClose={onClose}>
      <div className="receipt-area">
        <div className="receipt-guest">
          <strong>{fullName(c.guest(b.guestId))}</strong>
          <span>
            Room {c.room(b.roomId)?.number} · {dateLabel(b.checkIn)} – {dateLabel(b.checkOut)}
          </span>
        </div>
        <div className="receipt-line">
          <span>
            {nights(b.checkIn, b.checkOut)} nights × {money(b.rate)}
          </span>
          <strong>{money(c.total(b))}</strong>
        </div>
        <div className="receipt-line">
          <span>Payments received</span>
          <strong>{money(c.paid(b))}</strong>
        </div>
        <div className="bill-total">
          <span>Balance due</span>
          <strong>{money(balance)}</strong>
        </div>
        <div className="receipt-status">
          <Badge>{c.paymentStatus(b)}</Badge>
        </div>
        {history.length > 0 && (
          <>
            <h3 className="section-label">Payment history</h3>
            {history.map((p) => (
              <div className="receipt-line" key={p.id}>
                <span>
                  {p.method} · {dateLabel(p.date)}
                  <small>{p.id}</small>
                </span>
                <strong>{money(p.amount)}</strong>
              </div>
            ))}
          </>
        )}
      </div>
      {balance > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const value = Number(amount);
            if (!Number.isFinite(value) || value <= 0 || value > balance)
              return c.notify('Enter an amount within the outstanding balance.');
            try {
              const { data: payment } = await api.post('/payments', {
                bookingId: b.id,
                amount: value,
                method,
              });
              c.setPayments([...c.payments, payment]);
              setAmount(Math.max(0, balance - value));
              c.notify('Payment recorded successfully.');
            } catch (error) {
              c.notify(error.response?.data?.error || 'Payment could not be recorded.');
            }
          }}
        >
          <div className="form-grid">
            <Field
              label="Payment amount (PHP)"
              type="number"
              step="0.01"
              min="0.01"
              max={balance}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Field label="Payment method">
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {['Cash', 'Card', 'Other'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="form-hint">Records a payment received at the hotel. No card is charged.</p>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print bill
            </button>
            <button className="button primary">
              <CreditCard size={16} />
              Record payment
            </button>
          </div>
        </form>
      )}
      {balance === 0 && (
        <div className="modal-actions">
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print receipt
          </button>
          <button className="button primary" onClick={onClose}>
            Done
            <Check size={16} />
          </button>
        </div>
      )}
    </Modal>
  );
}
