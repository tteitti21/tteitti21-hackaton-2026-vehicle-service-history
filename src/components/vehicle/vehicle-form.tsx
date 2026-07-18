"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type HTMLInputTypeAttribute,
} from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import {
  collectVehicleFieldErrors,
  createVehicleInputSchema,
  type VehicleFieldErrors,
  type VehicleFieldName,
  type VehicleInput,
} from "@/domain/vehicle/vehicle-input";

const fuelTypeOptions = [
  ["petrol", "Bensiini"],
  ["diesel", "Diesel"],
  ["hybrid", "Hybridi"],
  ["plug_in_hybrid", "Lataushybridi"],
  ["electric", "Sähkö"],
  ["lpg", "Nestekaasu (LPG)"],
  ["cng", "Maakaasu (CNG)"],
  ["hydrogen", "Vety"],
  ["other", "Muu"],
] as const;

const transmissionOptions = [
  ["manual", "Manuaali"],
  ["automatic", "Automaatti"],
  ["cvt", "CVT"],
  ["dual_clutch", "Kaksoiskytkin"],
  ["automated_manual", "Robotisoitu manuaali"],
  ["other", "Muu"],
] as const;

const drivetrainOptions = [
  ["front_wheel_drive", "Etuveto"],
  ["rear_wheel_drive", "Takaveto"],
  ["all_wheel_drive", "Jatkuva neliveto"],
  ["four_wheel_drive", "Kytkettävä neliveto"],
  ["other", "Muu"],
] as const;

const countryOptions = [
  ["FI", "Suomi"],
  ["SE", "Ruotsi"],
  ["NO", "Norja"],
  ["DK", "Tanska"],
  ["DE", "Saksa"],
  ["EE", "Viro"],
  ["FR", "Ranska"],
  ["GB", "Yhdistynyt kuningaskunta"],
  ["US", "Yhdysvallat"],
  ["JP", "Japani"],
  ["OTHER", "Muu maa"],
] as const;

const countryLabels = Object.fromEntries(countryOptions) as Record<
  string,
  string
>;

const fuelTypeLabels = Object.fromEntries(fuelTypeOptions) as Record<
  string,
  string
>;

const transmissionLabels = Object.fromEntries(
  transmissionOptions,
) as Record<string, string>;

const drivetrainLabels = Object.fromEntries(drivetrainOptions) as Record<
  string,
  string
>;

export function VehicleForm() {
  const { state, updateVehicleField, confirmVehicle, resetSession } =
    useAnalysisSession();
  const [errors, setErrors] = useState<VehicleFieldErrors>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const handleFieldChange = (field: VehicleFieldName, value: string) => {
    updateVehicleField(field, value);
    setErrors((current) => {
      const relatedFields: VehicleFieldName[] =
        field === "modelYear" || field === "firstRegistrationYear"
          ? ["modelYear", "firstRegistrationYear"]
          : [field];

      if (relatedFields.every((relatedField) => current[relatedField] === undefined)) {
        return current;
      }

      const next = { ...current };
      for (const relatedField of relatedFields) {
        delete next[relatedField];
      }
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = createVehicleInputSchema().safeParse(state.vehicleDraft);

    if (!result.success) {
      setErrors(collectVehicleFieldErrors(result.error));
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    setErrors({});
    confirmVehicle(result.data);
  };

  const handleReset = () => {
    resetSession();
    setErrors({});
  };

  const errorCount = Object.keys(errors).length;
  const resetDisabled = state.status === "empty" || state.status === "reset";

  return (
    <section className="vehicleSection" aria-labelledby="vehicle-form-heading">
      <div className="vehicleSectionIntro">
        <div>
          <p className="sectionLabel">Vaihe 1 / Ajoneuvo</p>
          <h2 id="vehicle-form-heading">Kuvaile ajoneuvo mahdollisimman tarkasti.</h2>
        </div>
        <div className="memoryNotice">
          <span aria-hidden="true">○</span>
          <div>
            <strong>Vain tämän välilehden muistissa</strong>
            <p>
              Tietoja ei lähetetä eikä tallenneta selaimen pysyvään
              tallennustilaan. Sivun päivittäminen tyhjentää istunnon.
            </p>
          </div>
        </div>
      </div>

      <div className="vehicleWorkspace">
        <form
          className="vehicleForm"
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
        >
          {errorCount > 0 ? (
            <div
              className="formErrorSummary"
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
            >
              <strong>
                Tarkista {errorCount === 1 ? "merkitty kenttä" : "merkityt kentät"}.
              </strong>
              <p>
                Ajoneuvotietoja ei vahvistettu, koska lomakkeessa on{" "}
                {errorCount} {errorCount === 1 ? "virhe" : "virhettä"}.
              </p>
            </div>
          ) : null}

          <fieldset>
            <legend>Ajoneuvon perustiedot</legend>
            <p className="fieldGroupHint">
              Pakolliset kentät on merkitty tähdellä. Rekisterinumeroa tai
              valmistenumeroa ei tarvita.
            </p>
            <div className="formGrid">
              <TextField
                field="make"
                label="Merkki"
                required
                value={state.vehicleDraft.make}
                error={errors.make}
                onChange={handleFieldChange}
                placeholder="Esim. Toyota"
              />
              <TextField
                field="model"
                label="Malli"
                required
                value={state.vehicleDraft.model}
                error={errors.model}
                onChange={handleFieldChange}
                placeholder="Esim. Avensis"
              />
              <TextField
                field="generation"
                label="Sukupolvi tai alustakoodi"
                value={state.vehicleDraft.generation}
                error={errors.generation}
                onChange={handleFieldChange}
                placeholder="Esim. T27"
              />
              <TextField
                field="modelYear"
                label="Mallivuosi"
                value={state.vehicleDraft.modelYear}
                error={errors.modelYear}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1886"
                max={String(new Date().getFullYear() + 1)}
                placeholder="Esim. 2015"
              />
              <TextField
                field="firstRegistrationYear"
                label="Ensirekisteröintivuosi"
                value={state.vehicleDraft.firstRegistrationYear}
                error={errors.firstRegistrationYear}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1886"
                max={String(new Date().getFullYear())}
                placeholder="Esim. 2015"
              />
              <TextField
                field="currentOdometerKm"
                label="Nykyinen matkamittarilukema"
                suffix="km"
                required
                value={state.vehicleDraft.currentOdometerKm}
                error={errors.currentOdometerKm}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="0"
                max="10000000"
                placeholder="Esim. 184000"
                hint="Anna lukema kilometreinä ilman välilyöntejä."
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Moottori ja voimansiirto</legend>
            <p className="fieldGroupHint">
              Moottori- ja vaihteistokoodit auttavat myöhemmin erottamaan
              samantehoiset ajoneuvoversiot toisistaan.
            </p>
            <div className="formGrid">
              <TextField
                field="engineDisplacementLitres"
                label="Moottorin tilavuus"
                suffix="l"
                value={state.vehicleDraft.engineDisplacementLitres}
                error={errors.engineDisplacementLitres}
                onChange={handleFieldChange}
                inputMode="decimal"
                placeholder="Esim. 2,0"
              />
              <TextField
                field="engineCode"
                label="Moottorikoodi"
                value={state.vehicleDraft.engineCode}
                error={errors.engineCode}
                onChange={handleFieldChange}
                placeholder="Esim. 1AD-FTV"
              />
              <TextField
                field="powerKw"
                label="Teho"
                suffix="kW"
                value={state.vehicleDraft.powerKw}
                error={errors.powerKw}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1"
                max="2000"
                placeholder="Esim. 93"
              />
              <SelectField
                field="fuelType"
                label="Käyttövoima"
                value={state.vehicleDraft.fuelType}
                error={errors.fuelType}
                onChange={handleFieldChange}
                options={fuelTypeOptions}
              />
              <SelectField
                field="transmissionType"
                label="Vaihteistotyyppi"
                value={state.vehicleDraft.transmissionType}
                error={errors.transmissionType}
                onChange={handleFieldChange}
                options={transmissionOptions}
              />
              <TextField
                field="transmissionCode"
                label="Vaihteistokoodi"
                value={state.vehicleDraft.transmissionCode}
                error={errors.transmissionCode}
                onChange={handleFieldChange}
                placeholder="Esim. K311"
              />
              <SelectField
                field="drivetrain"
                label="Vetotapa"
                value={state.vehicleDraft.drivetrain}
                error={errors.drivetrain}
                onChange={handleFieldChange}
                options={drivetrainOptions}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Maa, markkina ja lisätiedot</legend>
            <p className="fieldGroupHint">
              Huolto-ohjelmat voivat vaihdella markkina-alueen ja
              käyttöolosuhteiden mukaan.
            </p>
            <div className="formGrid">
              <SelectField
                field="country"
                label="Ajoneuvon maa"
                required
                value={state.vehicleDraft.country}
                error={errors.country}
                onChange={handleFieldChange}
                options={countryOptions}
                allowEmpty={false}
              />
              <TextField
                field="market"
                label="Markkina-alue"
                value={state.vehicleDraft.market}
                error={errors.market}
                onChange={handleFieldChange}
                placeholder="Esim. Eurooppa"
              />
              <TextAreaField
                field="additionalDetails"
                label="Muut tiedossa olevat versiotiedot"
                value={state.vehicleDraft.additionalDetails}
                error={errors.additionalDetails}
                onChange={handleFieldChange}
                placeholder="Esim. varustetaso, tuontimaa tai muu epävarma tieto"
              />
            </div>
          </fieldset>

          <div className="formActions">
            <button className="primaryButton" type="submit">
              Vahvista ajoneuvotiedot
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={handleReset}
              disabled={resetDisabled}
            >
              Tyhjennä istunto
            </button>
          </div>
        </form>

        <aside className="sessionPanel" aria-labelledby="session-heading">
          <p className="sectionLabel">Istunnon tila</p>
          <h3 id="session-heading">{sessionHeading(state.status)}</h3>
          <p className="sessionStatus" aria-live="polite">
            {sessionDescription(state.status)}
          </p>

          {state.confirmedVehicle === null ? (
            <div className="emptySession">
              <span aria-hidden="true">01</span>
              <p>
                Vahvistettu ajoneuvo näkyy tässä. Tietoja tarvitaan myöhemmin
                ajoneuvoversion ja sopivien huoltolähteiden rajaamiseen.
              </p>
            </div>
          ) : (
            <VehicleSummary vehicle={state.confirmedVehicle} />
          )}

          <div className="sessionBoundary">
            <strong>Istuntoa ei tallenneta</strong>
            <p>
              Ei localStoragea, IndexedDB:tä, evästeitä eikä palvelimen
              tietokantaa.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

interface TextFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  type?: HTMLInputTypeAttribute;
  inputMode?: "decimal" | "numeric" | "text";
  min?: string;
  max?: string;
  placeholder?: string;
  hint?: string;
  suffix?: string;
  required?: boolean;
}

function TextField({
  field,
  label,
  value,
  error,
  onChange,
  type = "text",
  inputMode,
  min,
  max,
  placeholder,
  hint,
  suffix,
  required = false,
}: TextFieldProps) {
  const inputId = `vehicle-${field}`;
  const describedBy = [
    hint ? `${inputId}-hint` : null,
    error ? `${inputId}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`formField ${error ? "formFieldError" : ""}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className={suffix ? "inputWithSuffix" : undefined}>
        <input
          id={inputId}
          name={field}
          type={type}
          inputMode={inputMode}
          min={min}
          max={max}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          aria-required={required}
          required={required}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(field, event.target.value)
          }
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </div>
      {hint ? (
        <p className="fieldHint" id={`${inputId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  required?: boolean;
  allowEmpty?: boolean;
}

function SelectField({
  field,
  label,
  value,
  error,
  onChange,
  options,
  required = false,
  allowEmpty = true,
}: SelectFieldProps) {
  const inputId = `vehicle-${field}`;

  return (
    <div className={`formField ${error ? "formFieldError" : ""}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={inputId}
        name={field}
        value={value}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-required={required}
        required={required}
        onChange={(event) => onChange(field, event.target.value)}
      >
        {allowEmpty ? <option value="">Ei tiedossa</option> : null}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  placeholder?: string;
}

function TextAreaField({
  field,
  label,
  value,
  error,
  onChange,
  placeholder,
}: TextAreaFieldProps) {
  const inputId = `vehicle-${field}`;

  return (
    <div
      className={`formField formFieldWide ${error ? "formFieldError" : ""}`}
    >
      <label htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        name={field}
        value={value}
        placeholder={placeholder}
        rows={4}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function sessionHeading(status: "empty" | "editing" | "confirmed" | "reset") {
  switch (status) {
    case "empty":
      return "Ei vahvistettua ajoneuvoa";
    case "editing":
      return "Tiedot odottavat vahvistusta";
    case "confirmed":
      return "Ajoneuvo vahvistettu";
    case "reset":
      return "Istunto on tyhjennetty";
  }
}

function sessionDescription(
  status: "empty" | "editing" | "confirmed" | "reset",
) {
  switch (status) {
    case "empty":
      return "Täytä vähintään merkki, malli ja nykyinen matkamittarilukema.";
    case "editing":
      return "Luonnos on vain muistissa. Vahvista tiedot ennen seuraavaa vaihetta.";
    case "confirmed":
      return "Ajoneuvotiedot on vahvistettu tämän välilehden istuntoon.";
    case "reset":
      return "Kaikki tämän istunnon ajoneuvotiedot poistettiin muistista.";
  }
}

function VehicleSummary({ vehicle }: Readonly<{ vehicle: VehicleInput }>) {
  const variantDetails = [
    vehicle.generation,
    vehicle.modelYear ? `mallivuosi ${vehicle.modelYear}` : undefined,
    vehicle.engineDisplacementLitres
      ? `${vehicle.engineDisplacementLitres.toLocaleString("fi-FI")} l`
      : undefined,
    vehicle.engineCode,
    vehicle.powerKw ? `${vehicle.powerKw} kW` : undefined,
    vehicle.fuelType ? fuelTypeLabels[vehicle.fuelType] : undefined,
    vehicle.transmissionType
      ? transmissionLabels[vehicle.transmissionType]
      : undefined,
    vehicle.transmissionCode,
    vehicle.drivetrain ? drivetrainLabels[vehicle.drivetrain] : undefined,
  ].filter((detail): detail is string => detail !== undefined);

  return (
    <div className="vehicleSummary" data-testid="confirmed-vehicle">
      <p className="summaryKicker">Vahvistettu ajoneuvo</p>
      <h4>
        {vehicle.make} {vehicle.model}
      </h4>
      {variantDetails.length > 0 ? (
        <ul className="variantTags" aria-label="Ajoneuvoversion tiedot">
          {variantDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      <dl>
        <div>
          <dt>Matkamittari</dt>
          <dd>{vehicle.currentOdometerKm.toLocaleString("fi-FI")} km</dd>
        </div>
        <div>
          <dt>Maa</dt>
          <dd>{countryLabels[vehicle.country]}</dd>
        </div>
        {vehicle.market ? (
          <div>
            <dt>Markkina</dt>
            <dd>{vehicle.market}</dd>
          </div>
        ) : null}
        {vehicle.firstRegistrationYear ? (
          <div>
            <dt>Ensirekisteröinti</dt>
            <dd>{vehicle.firstRegistrationYear}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
