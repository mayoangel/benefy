import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons } from '../icons';

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
};

export default function Icon({ name }: IconProps) {
  return (
    <span className="icon" aria-hidden="true">
      <FontAwesomeIcon icon={icons[name]} />
    </span>
  );
}